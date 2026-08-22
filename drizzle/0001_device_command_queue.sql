CREATE TYPE "public"."device_command_status" AS ENUM('pending', 'fetched', 'acknowledged', 'failed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "device_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"session_id" uuid,
	"command" varchar(40) NOT NULL,
	"payload" jsonb,
	"status" "device_command_status" DEFAULT 'pending' NOT NULL,
	"priority" smallint DEFAULT 0 NOT NULL,
	"issued_by" uuid,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fetched_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"failure_reason" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_commands_pending_idx" ON "device_commands" USING btree ("device_id","status","priority");--> statement-breakpoint
CREATE INDEX "device_commands_session_idx" ON "device_commands" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "device_commands_expiry_idx" ON "device_commands" USING btree ("expires_at");