import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * כל ה־enums של המערכת במקום אחד.
 * שינוי ערך כאן מחייב migration — ולכן ערכים "עסקיים" שצפויים להשתנות
 * (סיבות זיכוי, סוגי תקלה) יושבים בטבלאות lookup ולא כאן.
 */

// ─── זהות והרשאות ───
export const userStatusEnum = pgEnum('user_status', [
  'active',
  'invited',
  'suspended',
  'blocked',
  'deleted',
]);

export const playerLevelEnum = pgEnum('player_level', ['1', '2', '3']);
export const dominantHandEnum = pgEnum('dominant_hand', ['right', 'left', 'unknown']);

/** חמש רמות החברות מפרק 11.3 בתוכנית העסקית */
export const membershipTierEnum = pgEnum('membership_tier', ['X1', 'X2', 'X3', 'X4', 'X5']);

// ─── רשת ומועדונים ───
export const clubStatusEnum = pgEnum('club_status', [
  'prospect',
  'pilot',
  'active',
  'paused',
  'churned',
]);

/** שלושת מודלי הגבייה מגיליון "מודלים חלופיים" */
export const pricingModelEnum = pgEnum('pricing_model', [
  'setup_fee_usage', // א׳ — דמי הקמה + VELA-X גובה מהשחקן לפי שעה
  'monthly_subscription', // ב׳ — VELA-X בעלת הציוד, המועדון משלם חודשי
  'hybrid', // ג׳ — הקמה מסובסדת + דמי שימוש חודשיים קטנים
]);

export const contractStatusEnum = pgEnum('contract_status', [
  'draft',
  'sent',
  'signed',
  'active',
  'expired',
  'terminated',
]);

export const stationStatusEnum = pgEnum('station_status', [
  'planned',
  'installing',
  'active',
  'suspended',
  'decommissioned',
]);

/** עמדה רזה (5,500 ₪) מול עמדה מלאה (10,000 ₪) — גיליון הנחות סעיף ז׳ */
export const stationTypeEnum = pgEnum('station_type', ['lean', 'full']);

// ─── מכשירים ───
export const deviceStatusEnum = pgEnum('device_status', [
  'in_stock',
  'active',
  'maintenance',
  'offline',
  'quarantined',
  'retired',
  'lost',
]);

export const deviceConnectivityEnum = pgEnum('device_connectivity', ['online', 'offline', 'unknown']);

export const firmwareChannelEnum = pgEnum('firmware_channel', ['stable', 'beta', 'dev']);

export const deviceAssignmentReasonEnum = pgEnum('device_assignment_reason', [
  'initial_install',
  'replacement',
  'transfer',
  'maintenance_swap',
  'removal',
]);

// ─── Sessions ───
export const sessionStatusEnum = pgEnum('session_status', [
  'draft',
  'awaiting_payment',
  'paid',
  'authorized',
  'connecting',
  'active',
  'paused',
  'completed',
  'failed_to_start',
  'interrupted',
  'cancelled',
  'partially_refunded',
  'fully_refunded',
  'disputed',
]);

export const sessionEventTypeEnum = pgEnum('session_event_type', [
  'created',
  'payment_initiated',
  'payment_succeeded',
  'payment_failed',
  'token_issued',
  'ble_connecting',
  'ble_connected',
  'ble_failed',
  'started',
  'paused',
  'resumed',
  'stopped',
  'completed',
  'force_ended',
  'error',
  'safety_alert',
  'marked_faulty',
  'extended',
  'refunded',
  'note',
]);

export const purchaseChannelEnum = pgEnum('purchase_channel', [
  'station_qr',
  'station_nfc',
  'app',
  'coach_link',
  'club_staff',
  'referral',
]);

export const peakWindowEnum = pgEnum('peak_window', ['peak', 'off_peak']);

// ─── תשלומים ───
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'authorized',
  'captured',
  'failed',
  'voided',
  'refunded',
  'partially_refunded',
  'chargeback',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'card',
  'apple_pay',
  'google_pay',
  'wallet_credit',
  'club_staff_manual',
  'coupon_full',
]);

export const refundTypeEnum = pgEnum('refund_type', ['full', 'partial']);
export const refundDestinationEnum = pgEnum('refund_destination', ['original_method', 'wallet']);
export const refundStatusEnum = pgEnum('refund_status', [
  'pending_approval',
  'approved',
  'rejected',
  'processing',
  'completed',
  'failed',
]);

/** סיבות זיכוי מובנות — חובה לפי סעיף 11 בהנחיות */
export const refundReasonEnum = pgEnum('refund_reason', [
  'failed_to_start',
  'device_malfunction',
  'station_unavailable',
  'ble_failure',
  'ball_shortage',
  'safety_incident',
  'double_charge',
  'customer_request',
  'club_request',
  'goodwill',
  'billing_error',
  'chargeback_settlement',
  'other',
]);

export const couponTypeEnum = pgEnum('coupon_type', ['percentage', 'fixed_amount', 'free_session']);

export const walletTxTypeEnum = pgEnum('wallet_tx_type', [
  'credit_refund',
  'credit_goodwill',
  'credit_promo',
  'debit_session',
  'expiry',
  'adjustment',
]);

// ─── שירות ותקלות ───
export const ticketCategoryEnum = pgEnum('ticket_category', [
  'ble',
  'firmware',
  'battery',
  'charger',
  'feed_motor',
  'wheels',
  'remote',
  'balls',
  'lock',
  'screen',
  'qr_nfc',
  'payment',
  'app',
  'backend',
  'safety',
  'physical_damage',
  'theft_loss',
  'other',
]);

export const ticketSeverityEnum = pgEnum('ticket_severity', ['low', 'medium', 'high', 'critical']);

export const ticketStatusEnum = pgEnum('ticket_status', [
  'new',
  'triaged',
  'assigned',
  'waiting_for_club',
  'waiting_for_customer',
  'waiting_for_part',
  'technician_scheduled',
  'in_progress',
  'resolved',
  'closed',
  'reopened',
]);

export const ticketSourceEnum = pgEnum('ticket_source', [
  'player_app',
  'club_staff',
  'ops_console',
  'telemetry_auto',
  'support_agent',
  'automation_rule',
]);

// ─── תחזוקה ומלאי ───
export const maintenanceTriggerEnum = pgEnum('maintenance_trigger', [
  'calendar',
  'operating_hours',
  'session_count',
  'ball_count',
  'event_based',
]);

export const maintenanceTaskStatusEnum = pgEnum('maintenance_task_status', [
  'scheduled',
  'due',
  'overdue',
  'in_progress',
  'completed',
  'skipped',
]);

export const checklistFrequencyEnum = pgEnum('checklist_frequency', ['daily', 'weekly', 'monthly']);

export const checklistSubmissionStatusEnum = pgEnum('checklist_submission_status', [
  'pending',
  'completed',
  'completed_with_issues',
  'missed',
]);

export const inventoryCategoryEnum = pgEnum('inventory_category', [
  'machine',
  'spare_machine',
  'balls',
  'charger',
  'battery',
  'wheels',
  'motor',
  'cables',
  'remote',
  'qr_nfc_tag',
  'screen',
  'stand_part',
  'safety_equipment',
  'other',
]);

export const inventoryMovementTypeEnum = pgEnum('inventory_movement_type', [
  'purchase_in',
  'transfer',
  'allocate_technician',
  'consume_ticket',
  'consume_maintenance',
  'return',
  'write_off',
  'stock_count_adjust',
]);

// ─── Earn-Back ───
export const earnBackStatusEnum = pgEnum('earn_back_status', [
  'draft',
  'active',
  'met',
  'at_risk',
  'breached_by_club',
  'settled_topup',
  'settled_buyback',
  'cancelled',
]);

export const earnBackConditionStatusEnum = pgEnum('earn_back_condition_status', [
  'met',
  'not_met',
  'waived',
  'not_measured',
]);

export const bookingLinkTypeEnum = pgEnum('booking_link_type', [
  'machine_linked', // הזמנה עם session_id תואם
  'incremental', // אומתה כהכנסה שלא הייתה קיימת בלי המכונה
  'baseline', // הייתה מתקיימת גם ללא המכונה
  'unverified',
]);

// ─── מאמנים ───
export const coachVerificationEnum = pgEnum('coach_verification', [
  'pending',
  'verified',
  'rejected',
  'suspended',
]);

export const attributionTypeEnum = pgEnum('attribution_type', [
  'referral',
  'retention',
  'homework',
  'content_royalty',
]);

export const commissionStatusEnum = pgEnum('commission_status', [
  'accrued',
  'holding_period',
  'approved',
  'paid',
  'clawed_back',
  'rejected',
]);

// ─── תוכן ───
export const drillTypeEnum = pgEnum('drill_type', [
  'single_stroke',
  'combination',
  'custom_drill',
  'program',
  'coach_homework',
  'quick_start',
  'challenge',
  'screen_content',
]);

export const contentStatusEnum = pgEnum('content_status', [
  'draft',
  'review',
  'published',
  'archived',
]);

export const shotSequenceEnum = pgEnum('shot_sequence', ['fixed', 'random']);

// ─── Rewards ───
export const rewardsTxTypeEnum = pgEnum('rewards_tx_type', [
  'earn_session',
  'earn_streak',
  'earn_challenge',
  'earn_referral',
  'earn_manual',
  'redeem',
  'expire',
  'reverse',
]);

export const challengeStatusEnum = pgEnum('challenge_status', [
  'draft',
  'active',
  'completed',
  'archived',
]);

// ─── CRM ───
export const leadStageEnum = pgEnum('lead_stage', [
  'lead',
  'contacted',
  'qualified',
  'demo_scheduled',
  'demo_completed',
  'proposal_sent',
  'negotiation',
  'pilot_agreed',
  'contract_sent',
  'contract_signed',
  'installation_scheduled',
  'live',
  'lost',
  'on_hold',
]);

export const crmActivityTypeEnum = pgEnum('crm_activity_type', [
  'call',
  'email',
  'meeting',
  'demo',
  'note',
  'stage_change',
  'proposal',
  'site_visit',
]);

export const taskStatusEnum = pgEnum('task_status', ['open', 'in_progress', 'done', 'cancelled']);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);

// ─── Display CMS ───
export const screenStatusEnum = pgEnum('screen_status', ['online', 'offline', 'unknown']);
export const mediaTypeEnum = pgEnum('media_type', ['image', 'video', 'html']);
export const moderationStatusEnum = pgEnum('moderation_status', [
  'pending',
  'approved',
  'rejected',
  'blocked',
]);

// ─── מערכת ───
export const settingValueTypeEnum = pgEnum('setting_value_type', [
  'number',
  'percentage',
  'currency',
  'string',
  'boolean',
  'json',
  'duration_minutes',
]);

/** רמת האמון בהנחה — verified / assumed / disputed. ראה OPS_CONSOLE_ANALYSIS.md סעיף 5 */
export const settingConfidenceEnum = pgEnum('setting_confidence', [
  'verified',
  'assumed',
  'disputed',
]);

export const scenarioEnum = pgEnum('scenario', ['plan', 'realistic', 'conservative']);

export const notificationSeverityEnum = pgEnum('notification_severity', [
  'info',
  'warning',
  'critical',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'in_app',
  'email',
  'sms',
  'whatsapp',
  'slack',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'pending',
  'sent',
  'failed',
  'read',
  'dismissed',
]);

export const auditActionEnum = pgEnum('audit_action', [
  'create',
  'update',
  'delete',
  'soft_delete',
  'restore',
  'login',
  'logout',
  'login_failed',
  'permission_denied',
  'export',
  'impersonate_start',
  'impersonate_end',
  'financial_action',
  'device_command',
  'setting_change',
  'approval',
]);

export const consentTypeEnum = pgEnum('consent_type', [
  'terms_of_service',
  'privacy_policy',
  'marketing',
  'ugc_display',
  'health_data',
  'coach_data_sharing',
]);
