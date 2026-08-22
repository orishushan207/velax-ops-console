CREATE TYPE "public"."gateway_status" AS ENUM('provisioned', 'active', 'unreachable', 'retired');--> statement-breakpoint
CREATE TABLE "station_gateways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"gateway_id" varchar(64) NOT NULL,
	"key_hash" varchar(128) NOT NULL,
	"key_rotated_at" timestamp with time zone,
	"status" "gateway_status" DEFAULT 'provisioned' NOT NULL,
	"hardware_model" varchar(80),
	"firmware_version" varchar(40),
	"last_seen_at" timestamp with time zone,
	"last_ip_address" varchar(64),
	"ble_connected" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "station_gateways" ADD CONSTRAINT "station_gateways_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "station_gateways_gateway_key" ON "station_gateways" USING btree ("gateway_id");--> statement-breakpoint
CREATE UNIQUE INDEX "station_gateways_key_hash" ON "station_gateways" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "station_gateways_station_idx" ON "station_gateways" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "station_gateways_seen_idx" ON "station_gateways" USING btree ("last_seen_at");