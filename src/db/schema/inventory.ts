import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { demoFlag, money, softDelete, timestamps } from './_shared';
import { inventoryCategoryEnum, inventoryMovementTypeEnum } from './enums';
import { users } from './identity';
import { clubs } from './network';
import { devices } from './devices';
import { supportTickets } from './support';
import { maintenanceTasks } from './maintenance';

export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    contactName: varchar('contact_name', { length: 200 }),
    email: varchar('email', { length: 320 }),
    phone: varchar('phone', { length: 32 }),
    country: varchar('country', { length: 80 }),
    leadTimeDays: integer('lead_time_days'),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [index('suppliers_name_idx').on(t.name)],
);

export const inventoryLocations = pgTable(
  'inventory_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 160 }).notNull(),
    /** warehouse | club | technician | transit | scrap */
    locationType: varchar('location_type', { length: 40 }).notNull().default('warehouse'),
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'set null' }),
    technicianId: uuid('technician_id').references(() => users.id, { onDelete: 'set null' }),
    address: text('address'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    index('inventory_locations_type_idx').on(t.locationType),
    index('inventory_locations_club_idx').on(t.clubId),
  ],
);

export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sku: varchar('sku', { length: 60 }).notNull(),
    nameHe: varchar('name_he', { length: 200 }).notNull(),
    category: inventoryCategoryEnum('category').notNull(),
    unitOfMeasure: varchar('unit_of_measure', { length: 20 }).notNull().default('יחידה'),
    unitCost: money('unit_cost').notNull().default('0'),
    supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    /** רף מינימום למלאי — מתחתיו נשלחת התראה */
    reorderPoint: integer('reorder_point').notNull().default(0),
    reorderQuantity: integer('reorder_quantity').notNull().default(0),
    /** מלאי כולל בכל המיקומים — נגזר מ־inventory_movements ומעודכן בכל תנועה */
    quantityOnHand: integer('quantity_on_hand').notNull().default(0),
    isTrackedBySerial: boolean('is_tracked_by_serial').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    notes: text('notes'),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('inventory_items_sku_key').on(t.sku),
    index('inventory_items_category_idx').on(t.category),
    index('inventory_items_reorder_idx').on(t.quantityOnHand, t.reorderPoint),
  ],
);

/** תנועת מלאי. כל שינוי כמות עובר דרך כאן — אין עדכון ידני של quantityOnHand. */
export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    movementType: inventoryMovementTypeEnum('movement_type').notNull(),
    /** חיובי = כניסה, שלילי = יציאה */
    quantity: integer('quantity').notNull(),
    fromLocationId: uuid('from_location_id').references(() => inventoryLocations.id),
    toLocationId: uuid('to_location_id').references(() => inventoryLocations.id),
    unitCost: money('unit_cost').notNull().default('0'),
    totalCost: money('total_cost').notNull().default('0'),
    batchNumber: varchar('batch_number', { length: 60 }),
    serialNumbers: text('serial_numbers'),
    ticketId: uuid('ticket_id').references(() => supportTickets.id, { onDelete: 'set null' }),
    maintenanceTaskId: uuid('maintenance_task_id').references(() => maintenanceTasks.id, {
      onDelete: 'set null',
    }),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
    performedBy: uuid('performed_by').references(() => users.id),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    note: text('note'),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    index('inventory_movements_item_time_idx').on(t.itemId, t.occurredAt),
    index('inventory_movements_type_idx').on(t.movementType),
    index('inventory_movements_ticket_idx').on(t.ticketId),
  ],
);

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [inventoryItems.supplierId], references: [suppliers.id] }),
  movements: many(inventoryMovements),
}));

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  item: one(inventoryItems, { fields: [inventoryMovements.itemId], references: [inventoryItems.id] }),
  fromLocation: one(inventoryLocations, {
    fields: [inventoryMovements.fromLocationId],
    references: [inventoryLocations.id],
  }),
  toLocation: one(inventoryLocations, {
    fields: [inventoryMovements.toLocationId],
    references: [inventoryLocations.id],
  }),
}));

export const inventoryLocationsRelations = relations(inventoryLocations, ({ one }) => ({
  club: one(clubs, { fields: [inventoryLocations.clubId], references: [clubs.id] }),
  technician: one(users, { fields: [inventoryLocations.technicianId], references: [users.id] }),
}));
