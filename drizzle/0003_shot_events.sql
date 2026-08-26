CREATE TABLE "shot_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"device_id" uuid,
	"station_id" uuid,
	"sequence" integer NOT NULL,
	"fired_at" timestamp with time zone NOT NULL,
	"commanded_lr" smallint,
	"commanded_ud" smallint,
	"commanded_velocity" smallint,
	"commanded_spin_type" smallint,
	"commanded_spin_amount" smallint,
	"interval_seconds" numeric(14, 4),
	"serve_mode" varchar(20),
	"point_index" smallint,
	"derived_speed_kmh" numeric(14, 4),
	"derived_height_level" smallint,
	"derived_angle_degrees" smallint,
	"calibration_ref" varchar(64),
	"extra" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shot_events" ADD CONSTRAINT "shot_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shot_events_session_sequence_key" ON "shot_events" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE INDEX "shot_events_session_idx" ON "shot_events" USING btree ("session_id","fired_at");--> statement-breakpoint
CREATE INDEX "shot_events_device_time_idx" ON "shot_events" USING btree ("device_id","fired_at");--> statement-breakpoint
CREATE INDEX "shot_events_station_time_idx" ON "shot_events" USING btree ("station_id","fired_at");