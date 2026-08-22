CREATE TYPE "public"."attribution_type" AS ENUM('referral', 'retention', 'homework', 'content_royalty');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'soft_delete', 'restore', 'login', 'logout', 'login_failed', 'permission_denied', 'export', 'impersonate_start', 'impersonate_end', 'financial_action', 'device_command', 'setting_change', 'approval');--> statement-breakpoint
CREATE TYPE "public"."booking_link_type" AS ENUM('machine_linked', 'incremental', 'baseline', 'unverified');--> statement-breakpoint
CREATE TYPE "public"."challenge_status" AS ENUM('draft', 'active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."checklist_frequency" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."checklist_submission_status" AS ENUM('pending', 'completed', 'completed_with_issues', 'missed');--> statement-breakpoint
CREATE TYPE "public"."club_status" AS ENUM('prospect', 'pilot', 'active', 'paused', 'churned');--> statement-breakpoint
CREATE TYPE "public"."coach_verification" AS ENUM('pending', 'verified', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."commission_status" AS ENUM('accrued', 'holding_period', 'approved', 'paid', 'clawed_back', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('terms_of_service', 'privacy_policy', 'marketing', 'ugc_display', 'health_data', 'coach_data_sharing');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'review', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('draft', 'sent', 'signed', 'active', 'expired', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."coupon_type" AS ENUM('percentage', 'fixed_amount', 'free_session');--> statement-breakpoint
CREATE TYPE "public"."crm_activity_type" AS ENUM('call', 'email', 'meeting', 'demo', 'note', 'stage_change', 'proposal', 'site_visit');--> statement-breakpoint
CREATE TYPE "public"."device_assignment_reason" AS ENUM('initial_install', 'replacement', 'transfer', 'maintenance_swap', 'removal');--> statement-breakpoint
CREATE TYPE "public"."device_connectivity" AS ENUM('online', 'offline', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('in_stock', 'active', 'maintenance', 'offline', 'quarantined', 'retired', 'lost');--> statement-breakpoint
CREATE TYPE "public"."dominant_hand" AS ENUM('right', 'left', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."drill_type" AS ENUM('single_stroke', 'combination', 'custom_drill', 'program', 'coach_homework', 'quick_start', 'challenge', 'screen_content');--> statement-breakpoint
CREATE TYPE "public"."earn_back_condition_status" AS ENUM('met', 'not_met', 'waived', 'not_measured');--> statement-breakpoint
CREATE TYPE "public"."earn_back_status" AS ENUM('draft', 'active', 'met', 'at_risk', 'breached_by_club', 'settled_topup', 'settled_buyback', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."firmware_channel" AS ENUM('stable', 'beta', 'dev');--> statement-breakpoint
CREATE TYPE "public"."inventory_category" AS ENUM('machine', 'spare_machine', 'balls', 'charger', 'battery', 'wheels', 'motor', 'cables', 'remote', 'qr_nfc_tag', 'screen', 'stand_part', 'safety_equipment', 'other');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_type" AS ENUM('purchase_in', 'transfer', 'allocate_technician', 'consume_ticket', 'consume_maintenance', 'return', 'write_off', 'stock_count_adjust');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('lead', 'contacted', 'qualified', 'demo_scheduled', 'demo_completed', 'proposal_sent', 'negotiation', 'pilot_agreed', 'contract_sent', 'contract_signed', 'installation_scheduled', 'live', 'lost', 'on_hold');--> statement-breakpoint
CREATE TYPE "public"."maintenance_task_status" AS ENUM('scheduled', 'due', 'overdue', 'in_progress', 'completed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."maintenance_trigger" AS ENUM('calendar', 'operating_hours', 'session_count', 'ball_count', 'event_based');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('image', 'video', 'html');--> statement-breakpoint
CREATE TYPE "public"."membership_tier" AS ENUM('X1', 'X2', 'X3', 'X4', 'X5');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'approved', 'rejected', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email', 'sms', 'whatsapp', 'slack');--> statement-breakpoint
CREATE TYPE "public"."notification_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed', 'read', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card', 'apple_pay', 'google_pay', 'wallet_credit', 'club_staff_manual', 'coupon_full');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'authorized', 'captured', 'failed', 'voided', 'refunded', 'partially_refunded', 'chargeback');--> statement-breakpoint
CREATE TYPE "public"."peak_window" AS ENUM('peak', 'off_peak');--> statement-breakpoint
CREATE TYPE "public"."player_level" AS ENUM('1', '2', '3');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('setup_fee_usage', 'monthly_subscription', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."purchase_channel" AS ENUM('station_qr', 'station_nfc', 'app', 'coach_link', 'club_staff', 'referral');--> statement-breakpoint
CREATE TYPE "public"."refund_destination" AS ENUM('original_method', 'wallet');--> statement-breakpoint
CREATE TYPE "public"."refund_reason" AS ENUM('failed_to_start', 'device_malfunction', 'station_unavailable', 'ble_failure', 'ball_shortage', 'safety_incident', 'double_charge', 'customer_request', 'club_request', 'goodwill', 'billing_error', 'chargeback_settlement', 'other');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending_approval', 'approved', 'rejected', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."refund_type" AS ENUM('full', 'partial');--> statement-breakpoint
CREATE TYPE "public"."rewards_tx_type" AS ENUM('earn_session', 'earn_streak', 'earn_challenge', 'earn_referral', 'earn_manual', 'redeem', 'expire', 'reverse');--> statement-breakpoint
CREATE TYPE "public"."scenario" AS ENUM('plan', 'realistic', 'conservative');--> statement-breakpoint
CREATE TYPE "public"."screen_status" AS ENUM('online', 'offline', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."session_event_type" AS ENUM('created', 'payment_initiated', 'payment_succeeded', 'payment_failed', 'token_issued', 'ble_connecting', 'ble_connected', 'ble_failed', 'started', 'paused', 'resumed', 'stopped', 'completed', 'force_ended', 'error', 'safety_alert', 'marked_faulty', 'extended', 'refunded', 'note');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('draft', 'awaiting_payment', 'paid', 'authorized', 'connecting', 'active', 'paused', 'completed', 'failed_to_start', 'interrupted', 'cancelled', 'partially_refunded', 'fully_refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."setting_confidence" AS ENUM('verified', 'assumed', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."setting_value_type" AS ENUM('number', 'percentage', 'currency', 'string', 'boolean', 'json', 'duration_minutes');--> statement-breakpoint
CREATE TYPE "public"."shot_sequence" AS ENUM('fixed', 'random');--> statement-breakpoint
CREATE TYPE "public"."station_status" AS ENUM('planned', 'installing', 'active', 'suspended', 'decommissioned');--> statement-breakpoint
CREATE TYPE "public"."station_type" AS ENUM('lean', 'full');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('ble', 'firmware', 'battery', 'charger', 'feed_motor', 'wheels', 'remote', 'balls', 'lock', 'screen', 'qr_nfc', 'payment', 'app', 'backend', 'safety', 'physical_damage', 'theft_loss', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."ticket_source" AS ENUM('player_app', 'club_staff', 'ops_console', 'telemetry_auto', 'support_agent', 'automation_rule');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('new', 'triaged', 'assigned', 'waiting_for_club', 'waiting_for_customer', 'waiting_for_part', 'technician_scheduled', 'in_progress', 'resolved', 'closed', 'reopened');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'invited', 'suspended', 'blocked', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."wallet_tx_type" AS ENUM('credit_refund', 'credit_goodwill', 'credit_promo', 'debit_session', 'expiry', 'adjustment');--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"impersonated_by_user_id" uuid,
	"impersonation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"consent_type" "consent_type" NOT NULL,
	"granted" boolean NOT NULL,
	"version" varchar(32) NOT NULL,
	"ip_address" varchar(64),
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(96) NOT NULL,
	"name_he" varchar(160) NOT NULL,
	"category" varchar(64) NOT NULL,
	"description" text,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"level" "player_level" DEFAULT '1' NOT NULL,
	"level_overridden_by" uuid,
	"dominant_hand" "dominant_hand" DEFAULT 'unknown' NOT NULL,
	"preferred_club_id" uuid,
	"membership_tier" "membership_tier" DEFAULT 'X1' NOT NULL,
	"birth_year" varchar(4),
	"is_minor" boolean DEFAULT false NOT NULL,
	"guardian_consent_at" timestamp with time zone,
	"risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"acquisition_channel" varchar(64),
	"utm_source" varchar(120),
	"utm_campaign" varchar(120),
	"referred_by_coach_id" uuid,
	"merged_into_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"name_he" varchar(100) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_club_scoped" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_title" varchar(120),
	"department" varchar(80),
	"is_field_technician" boolean DEFAULT false NOT NULL,
	"regions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_club_scopes" (
	"user_id" uuid NOT NULL,
	"club_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320),
	"phone" varchar(32),
	"full_name" varchar(200) NOT NULL,
	"password_hash" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"is_staff" boolean DEFAULT false NOT NULL,
	"is_player" boolean DEFAULT false NOT NULL,
	"is_coach" boolean DEFAULT false NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret" text,
	"last_login_at" timestamp with time zone,
	"failed_login_count" varchar(8) DEFAULT '0' NOT NULL,
	"locked_until" timestamp with time zone,
	"locale" varchar(10) DEFAULT 'he-IL' NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Jerusalem' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"role" varchar(100),
	"email" varchar(320),
	"phone" varchar(32),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"contract_number" varchar(40) NOT NULL,
	"status" "contract_status" DEFAULT 'draft' NOT NULL,
	"pricing_model" "pricing_model" DEFAULT 'setup_fee_usage' NOT NULL,
	"setup_fee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"monthly_retainer" numeric(14, 2) DEFAULT '0' NOT NULL,
	"club_revenue_share_pct" numeric(8, 6) DEFAULT '0' NOT NULL,
	"consumer_price_per_hour" numeric(14, 2),
	"starts_on" date NOT NULL,
	"ends_on" date,
	"renewal_date" date,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"sla_policy_id" uuid,
	"signed_at" timestamp with time zone,
	"signed_by_name" varchar(200),
	"document_file_id" uuid,
	"terms" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_operating_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"opens_at" time NOT NULL,
	"closes_at" time NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(24) NOT NULL,
	"name" varchar(200) NOT NULL,
	"region" varchar(80) NOT NULL,
	"city" varchar(100) NOT NULL,
	"address" text,
	"latitude" numeric(14, 4),
	"longitude" numeric(14, 4),
	"status" "club_status" DEFAULT 'prospect' NOT NULL,
	"court_count" integer DEFAULT 0 NOT NULL,
	"joined_at" date,
	"off_peak_start" time DEFAULT '08:00' NOT NULL,
	"off_peak_end" time DEFAULT '16:00' NOT NULL,
	"off_peak_days" jsonb DEFAULT '[0,1,2,3,4]'::jsonb NOT NULL,
	"health_score" smallint,
	"health_score_at" timestamp with time zone,
	"health_score_breakdown" jsonb,
	"account_manager_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"is_indoor" boolean DEFAULT false NOT NULL,
	"revenue_per_hour_net" numeric(14, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"station_id" uuid,
	"name" varchar(120) NOT NULL,
	"serial_number" varchar(80),
	"status" "screen_status" DEFAULT 'unknown' NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"active_from" time DEFAULT '06:00' NOT NULL,
	"active_until" time DEFAULT '23:00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(120) NOT NULL,
	"station_type" "station_type" DEFAULT 'lean' NOT NULL,
	"status" "station_status" DEFAULT 'planned' NOT NULL,
	"location_description" text,
	"serves_court_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"installed_at" timestamp with time zone,
	"decommissioned_at" timestamp with time zone,
	"installed_cost" numeric(14, 2),
	"qr_code_token" varchar(64),
	"nfc_tag_id" varchar(64),
	"suspended_reason" text,
	"suspended_by" uuid,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"station_id" uuid,
	"club_id" uuid,
	"reason" "device_assignment_reason" NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unassigned_at" timestamp with time zone,
	"assigned_by" uuid,
	"replaced_device_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_firmware_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"from_version_id" uuid,
	"to_version_id" uuid NOT NULL,
	"is_rollback" boolean DEFAULT false NOT NULL,
	"succeeded" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"performed_by" uuid,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_telemetry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"session_id" uuid,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"battery_pct" smallint,
	"connectivity" "device_connectivity" DEFAULT 'unknown' NOT NULL,
	"rssi" smallint,
	"balls_fired" integer,
	"motor_temp_c" smallint,
	"error_code" varchar(40),
	"raw" jsonb,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar(64) NOT NULL,
	"serial_number" varchar(80) NOT NULL,
	"model" varchar(80) DEFAULT 'PT-9001' NOT NULL,
	"hardware_version" varchar(40),
	"firmware_version_id" uuid,
	"status" "device_status" DEFAULT 'in_stock' NOT NULL,
	"is_authorized" boolean DEFAULT false NOT NULL,
	"authorized_at" timestamp with time zone,
	"auth_key_encrypted" text,
	"auth_key_rotated_at" timestamp with time zone,
	"is_spare" boolean DEFAULT false NOT NULL,
	"current_club_id" uuid,
	"current_station_id" uuid,
	"connectivity" "device_connectivity" DEFAULT 'unknown' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"battery_pct" smallint,
	"operating_hours" numeric(14, 4) DEFAULT '0' NOT NULL,
	"ball_count" integer DEFAULT 0 NOT NULL,
	"estimated_balls_remaining" integer,
	"purchase_date" date,
	"purchase_cost" numeric(14, 2),
	"supplier_id" uuid,
	"warranty_until" date,
	"last_service_at" timestamp with time zone,
	"next_service_due" date,
	"quarantine_reason" text,
	"quarantined_by" uuid,
	"quarantined_at" timestamp with time zone,
	"retired_reason" text,
	"qr_code_token" varchar(64),
	"nfc_tag_id" varchar(64),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firmware_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" varchar(40) NOT NULL,
	"channel" "firmware_channel" DEFAULT 'stable' NOT NULL,
	"release_notes" text,
	"released_at" timestamp with time zone,
	"is_minimum_required" boolean DEFAULT false NOT NULL,
	"checksum" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "court_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"court_id" uuid,
	"external_booking_id" varchar(80),
	"session_id" uuid,
	"link_type" "booking_link_type" DEFAULT 'unverified' NOT NULL,
	"classified_by" uuid,
	"classified_at" timestamp with time zone,
	"classification_note" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"peak_window" "peak_window",
	"revenue_net" numeric(14, 2) DEFAULT '0' NOT NULL,
	"booked_by_phone" varchar(32),
	"is_cancelled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"event_type" "session_event_type" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"from_status" "session_status",
	"to_status" "session_status",
	"actor_user_id" uuid,
	"source" varchar(40) DEFAULT 'system' NOT NULL,
	"message" text,
	"payload" jsonb,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_label" varchar(80),
	"slot" smallint NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "session_players_slot_check" CHECK ("session_players"."slot" IN (1, 2))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(32) NOT NULL,
	"status" "session_status" DEFAULT 'draft' NOT NULL,
	"user_id" uuid,
	"is_guest" boolean DEFAULT false NOT NULL,
	"guest_phone" varchar(32),
	"guest_name" varchar(120),
	"club_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"device_id" uuid,
	"player_count" smallint DEFAULT 1 NOT NULL,
	"program_version_id" uuid,
	"drill_version_id" uuid,
	"level" "player_level",
	"scheduled_start_at" timestamp with time zone,
	"scheduled_minutes" integer DEFAULT 60 NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"actual_minutes" integer,
	"paused_minutes" integer DEFAULT 0 NOT NULL,
	"peak_window" "peak_window",
	"list_price_gross" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"coupon_id" uuid,
	"amount_gross" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"amount_net" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_rate_applied" numeric(14, 4) DEFAULT '0.18' NOT NULL,
	"refunded_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'ILS' NOT NULL,
	"estimated_balls" integer,
	"started_without_staff_help" boolean,
	"failure_reason" varchar(120),
	"end_reason" varchar(120),
	"purchase_channel" "purchase_channel" DEFAULT 'station_qr' NOT NULL,
	"coach_id" uuid,
	"referral_code" varchar(40),
	"utm_source" varchar(120),
	"utm_medium" varchar(120),
	"utm_campaign" varchar(120),
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"rewards_points_awarded" integer DEFAULT 0 NOT NULL,
	"session_token_hash" varchar(128),
	"token_issued_at" timestamp with time zone,
	"token_expires_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "sessions_player_count_check" CHECK ("sessions"."player_count" BETWEEN 1 AND 2),
	CONSTRAINT "sessions_amounts_non_negative" CHECK ("sessions"."amount_gross" >= 0 AND "sessions"."amount_net" >= 0),
	CONSTRAINT "sessions_refund_not_over" CHECK ("sessions"."refunded_amount" <= "sessions"."amount_gross")
);
--> statement-breakpoint
CREATE TABLE "chargebacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_gross" numeric(14, 2) NOT NULL,
	"provider_case_id" varchar(120),
	"reason_code" varchar(60),
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"respond_by_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"outcome" varchar(20) DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(40) NOT NULL,
	"name_he" varchar(160) NOT NULL,
	"coupon_type" "coupon_type" NOT NULL,
	"value" numeric(14, 2) NOT NULL,
	"max_discount_amount" numeric(14, 2),
	"min_purchase_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"max_redemptions" integer,
	"max_redemptions_per_user" integer DEFAULT 1 NOT NULL,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"restricted_club_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"off_peak_only" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"cost_to_company" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'ILS' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "credit_wallets_balance_non_negative" CHECK ("credit_wallets"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" varchar(40) NOT NULL,
	"invoice_type" varchar(40) NOT NULL,
	"club_id" uuid,
	"user_id" uuid,
	"payment_id" uuid,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"amount_net" numeric(14, 2) NOT NULL,
	"vat_amount" numeric(14, 2) NOT NULL,
	"amount_gross" numeric(14, 2) NOT NULL,
	"external_document_id" varchar(120),
	"file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"succeeded" boolean DEFAULT false NOT NULL,
	"provider" varchar(40) NOT NULL,
	"provider_response_code" varchar(40),
	"provider_response_message" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"latency_ms" integer,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(32) NOT NULL,
	"session_id" uuid,
	"user_id" uuid,
	"club_id" uuid,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"method" "payment_method" DEFAULT 'card' NOT NULL,
	"amount_gross" numeric(14, 2) NOT NULL,
	"vat_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"amount_net" numeric(14, 2) NOT NULL,
	"vat_rate_applied" numeric(14, 4) DEFAULT '0.18' NOT NULL,
	"currency" varchar(3) DEFAULT 'ILS' NOT NULL,
	"processing_fee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"provider" varchar(40) DEFAULT 'mock' NOT NULL,
	"provider_transaction_id" varchar(120),
	"provider_reference" varchar(120),
	"card_last4" varchar(4),
	"card_brand" varchar(24),
	"idempotency_key" varchar(96) NOT NULL,
	"captured_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_code" varchar(60),
	"failure_message" text,
	"invoice_id" uuid,
	"settlement_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_gross" > 0)
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(32) NOT NULL,
	"payment_id" uuid NOT NULL,
	"session_id" uuid,
	"ticket_id" uuid,
	"refund_type" "refund_type" NOT NULL,
	"destination" "refund_destination" DEFAULT 'original_method' NOT NULL,
	"status" "refund_status" DEFAULT 'pending_approval' NOT NULL,
	"amount_gross" numeric(14, 2) NOT NULL,
	"amount_net" numeric(14, 2) NOT NULL,
	"vat_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"reason" "refund_reason" NOT NULL,
	"reason_note" text NOT NULL,
	"requested_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"rejected_by" uuid,
	"rejection_reason" text,
	"is_automatic" boolean DEFAULT false NOT NULL,
	"automation_rule_id" uuid,
	"provider" varchar(40) DEFAULT 'mock' NOT NULL,
	"provider_refund_id" varchar(120),
	"idempotency_key" varchar(96) NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "refunds_amount_positive" CHECK ("refunds"."amount_gross" > 0)
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(40) NOT NULL,
	"settlement_date" date NOT NULL,
	"gross_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"fees_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"refunds_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"chargebacks_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"variance_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"is_reconciled" boolean DEFAULT false NOT NULL,
	"reconciled_by" uuid,
	"reconciled_at" timestamp with time zone,
	"external_reference" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"tx_type" "wallet_tx_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"balance_after" numeric(14, 2) NOT NULL,
	"session_id" uuid,
	"refund_id" uuid,
	"note" text,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_he" varchar(120) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"response_hours_low" integer DEFAULT 48 NOT NULL,
	"response_hours_medium" integer DEFAULT 24 NOT NULL,
	"response_hours_high" integer DEFAULT 4 NOT NULL,
	"response_hours_critical" integer DEFAULT 1 NOT NULL,
	"resolution_hours_low" integer DEFAULT 168 NOT NULL,
	"resolution_hours_medium" integer DEFAULT 72 NOT NULL,
	"resolution_hours_high" integer DEFAULT 48 NOT NULL,
	"resolution_hours_critical" integer DEFAULT 24 NOT NULL,
	"uptime_target_pct" integer DEFAULT 95 NOT NULL,
	"business_hours_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(32) NOT NULL,
	"title" varchar(250) NOT NULL,
	"description" text,
	"category" "ticket_category" NOT NULL,
	"severity" "ticket_severity" DEFAULT 'medium' NOT NULL,
	"status" "ticket_status" DEFAULT 'new' NOT NULL,
	"source" "ticket_source" DEFAULT 'ops_console' NOT NULL,
	"club_id" uuid,
	"station_id" uuid,
	"device_id" uuid,
	"session_id" uuid,
	"reported_by_user_id" uuid,
	"assignee_id" uuid,
	"sla_policy_id" uuid,
	"response_due_at" timestamp with time zone,
	"resolution_due_at" timestamp with time zone,
	"first_response_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"response_breached" boolean DEFAULT false NOT NULL,
	"resolution_breached" boolean DEFAULT false NOT NULL,
	"root_cause" text,
	"actions_taken" text,
	"parts_replaced" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"downtime_minutes" integer DEFAULT 0 NOT NULL,
	"downtime_started_at" timestamp with time zone,
	"downtime_ended_at" timestamp with time zone,
	"repair_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"refund_issued_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"closure_reason" varchar(120),
	"follow_up_required" boolean DEFAULT false NOT NULL,
	"follow_up_at" timestamp with time zone,
	"replacement_device_provided" boolean DEFAULT false NOT NULL,
	"replacement_device_id" uuid,
	"attachment_file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"device_logs" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"from_status" "ticket_status",
	"to_status" "ticket_status",
	"actor_user_id" uuid,
	"message" text,
	"is_internal" boolean DEFAULT true NOT NULL,
	"payload" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checklist_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"label_he" varchar(250) NOT NULL,
	"is_blocking" boolean DEFAULT false NOT NULL,
	"requires_photo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checklist_id" uuid NOT NULL,
	"club_id" uuid NOT NULL,
	"station_id" uuid,
	"device_id" uuid,
	"for_date" date NOT NULL,
	"status" "checklist_submission_status" DEFAULT 'pending' NOT NULL,
	"submitted_by" uuid,
	"submitted_at" timestamp with time zone,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"issues_reported" integer DEFAULT 0 NOT NULL,
	"created_ticket_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_he" varchar(160) NOT NULL,
	"frequency" "checklist_frequency" NOT NULL,
	"description" text,
	"estimated_seconds" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_he" varchar(160) NOT NULL,
	"description" text,
	"trigger" "maintenance_trigger" NOT NULL,
	"interval_value" numeric(14, 4) NOT NULL,
	"warn_ahead_value" numeric(14, 4) DEFAULT '0' NOT NULL,
	"applies_to_model" varchar(80),
	"estimated_minutes" integer DEFAULT 30 NOT NULL,
	"instructions" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(32) NOT NULL,
	"plan_id" uuid,
	"device_id" uuid,
	"station_id" uuid,
	"club_id" uuid,
	"status" "maintenance_task_status" DEFAULT 'scheduled' NOT NULL,
	"due_on" date NOT NULL,
	"trigger_snapshot" jsonb,
	"assignee_id" uuid,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"notes" text,
	"parts_used" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skip_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(60) NOT NULL,
	"name_he" varchar(200) NOT NULL,
	"category" "inventory_category" NOT NULL,
	"unit_of_measure" varchar(20) DEFAULT 'יחידה' NOT NULL,
	"unit_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"supplier_id" uuid,
	"reorder_point" integer DEFAULT 0 NOT NULL,
	"reorder_quantity" integer DEFAULT 0 NOT NULL,
	"quantity_on_hand" integer DEFAULT 0 NOT NULL,
	"is_tracked_by_serial" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"location_type" varchar(40) DEFAULT 'warehouse' NOT NULL,
	"club_id" uuid,
	"technician_id" uuid,
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"movement_type" "inventory_movement_type" NOT NULL,
	"quantity" integer NOT NULL,
	"from_location_id" uuid,
	"to_location_id" uuid,
	"unit_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"batch_number" varchar(60),
	"serial_numbers" text,
	"ticket_id" uuid,
	"maintenance_task_id" uuid,
	"device_id" uuid,
	"performed_by" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"contact_name" varchar(200),
	"email" varchar(320),
	"phone" varchar(32),
	"country" varchar(80),
	"lead_time_days" integer,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earn_back_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"measurement_id" uuid,
	"adjustment_type" varchar(40) NOT NULL,
	"amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"hours" numeric(14, 4) DEFAULT '0' NOT NULL,
	"days" integer DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"approved_by" uuid NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earn_back_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"contract_id" uuid,
	"status" "earn_back_status" DEFAULT 'draft' NOT NULL,
	"entry_price" numeric(14, 2) NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"operating_days_in_period" integer DEFAULT 156 NOT NULL,
	"court_revenue_per_hour_net" numeric(14, 2) NOT NULL,
	"required_hours" numeric(14, 4) NOT NULL,
	"required_hours_per_day" numeric(14, 4) NOT NULL,
	"incrementality_factor" numeric(8, 6) DEFAULT '0.700000' NOT NULL,
	"club_ball_cost_per_hour" numeric(14, 2) DEFAULT '0' NOT NULL,
	"exposure_cap" numeric(14, 2),
	"reserve_pct" numeric(8, 6) DEFAULT '0.125000' NOT NULL,
	"achieved_hours" numeric(14, 4) DEFAULT '0' NOT NULL,
	"verified_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"remaining_gap" numeric(14, 2) DEFAULT '0' NOT NULL,
	"required_run_rate_per_day" numeric(14, 4) DEFAULT '0' NOT NULL,
	"forecast_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"forecast_will_meet" boolean,
	"last_calculated_at" timestamp with time zone,
	"excluded_downtime_days" integer DEFAULT 0 NOT NULL,
	"club_breached_conditions" boolean DEFAULT false NOT NULL,
	"settlement_amount" numeric(14, 2),
	"settled_at" timestamp with time zone,
	"settlement_note" text,
	"document_file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earn_back_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"condition_key" varchar(80) NOT NULL,
	"name_he" varchar(250) NOT NULL,
	"target_value" numeric(14, 4),
	"unit" varchar(40),
	"measured_value" numeric(14, 4),
	"status" "earn_back_condition_status" DEFAULT 'not_measured' NOT NULL,
	"waived_by" uuid,
	"waived_reason" text,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earn_back_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"paid_session_hours" numeric(14, 4) DEFAULT '0' NOT NULL,
	"machine_linked_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"incremental_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"baseline_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"counted_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"club_ball_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_club_benefit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"cumulative_counted_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"off_peak_hours" numeric(14, 4) DEFAULT '0' NOT NULL,
	"uptime_pct" numeric(8, 6),
	"operating_days" integer DEFAULT 0 NOT NULL,
	"calculation_snapshot" jsonb,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"calculated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_attributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"attribution_type" "attribution_type" NOT NULL,
	"attributed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"is_rejected" boolean DEFAULT false NOT NULL,
	"rejection_reason" text,
	"source_referral_code" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"attribution_id" uuid,
	"session_id" uuid,
	"attribution_type" "attribution_type" NOT NULL,
	"status" "commission_status" DEFAULT 'accrued' NOT NULL,
	"base_amount_net" numeric(14, 2) DEFAULT '0' NOT NULL,
	"rate_pct" numeric(8, 6) DEFAULT '0' NOT NULL,
	"commission_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"accrued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"holding_until" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"payout_reference" varchar(80),
	"clawback_reason" text,
	"clawed_back_at" timestamp with time zone,
	"capped_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coaches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"bio" text,
	"verification" "coach_verification" DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"referral_code" varchar(40) NOT NULL,
	"home_club_id" uuid,
	"referral_bonus_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"retention_commission_pct" numeric(8, 6) DEFAULT '0' NOT NULL,
	"homework_commission_pct" numeric(8, 6) DEFAULT '0.075000' NOT NULL,
	"content_royalty_pct" numeric(8, 6) DEFAULT '0.175000' NOT NULL,
	"commission_cap_pct_per_customer" numeric(8, 6) DEFAULT '0.200000' NOT NULL,
	"attribution_window_days" integer DEFAULT 180 NOT NULL,
	"rating" numeric(14, 4),
	"rating_count" integer DEFAULT 0 NOT NULL,
	"agreement_signed_at" timestamp with time zone,
	"agreement_file_id" uuid,
	"content_rights_granted" boolean DEFAULT false NOT NULL,
	"suspended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homework_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"program_version_id" uuid,
	"title" varchar(200) NOT NULL,
	"instructions" text,
	"due_on" date,
	"target_sessions" integer DEFAULT 1 NOT NULL,
	"completed_sessions" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"session_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drill_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drill_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"description" text,
	"level" "player_level" DEFAULT '1' NOT NULL,
	"training_goal" varchar(200),
	"player_count" smallint DEFAULT 1 NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"shot_count" integer,
	"speed_kmh" smallint,
	"height_level" smallint,
	"spin_level" smallint,
	"depth_level" smallint,
	"angle_degrees" smallint,
	"frequency_per_minute" smallint,
	"sequence" "shot_sequence" DEFAULT 'fixed' NOT NULL,
	"shot_pattern" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"safety_instructions" text,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"archived_at" timestamp with time zone,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"completion_rate" numeric(8, 6),
	"avg_rating" numeric(14, 4),
	"retention_impact" numeric(8, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name_he" varchar(200) NOT NULL,
	"drill_type" "drill_type" NOT NULL,
	"created_by_coach_id" uuid,
	"created_by_user_id" uuid,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"description" text,
	"level" "player_level" DEFAULT '1' NOT NULL,
	"training_goal" varchar(200),
	"player_count" smallint DEFAULT 1 NOT NULL,
	"duration_minutes" integer DEFAULT 45 NOT NULL,
	"drill_version_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"safety_instructions" text,
	"is_certified" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"archived_at" timestamp with time zone,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"completion_rate" numeric(8, 6),
	"avg_rating" numeric(14, 4),
	"retention_impact" numeric(8, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name_he" varchar(200) NOT NULL,
	"created_by_coach_id" uuid,
	"created_by_user_id" uuid,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_he" varchar(200) NOT NULL,
	"description" text,
	"status" "challenge_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"points_reward" integer DEFAULT 0 NOT NULL,
	"coupon_id" uuid,
	"participant_count" integer DEFAULT 0 NOT NULL,
	"completion_count" integer DEFAULT 0 NOT NULL,
	"estimated_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_user_id" uuid NOT NULL,
	"referred_user_id" uuid,
	"code" varchar(40) NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"qualifying_sessions" integer DEFAULT 0 NOT NULL,
	"required_sessions" integer DEFAULT 2 NOT NULL,
	"qualified_at" timestamp with time zone,
	"rewarded_at" timestamp with time zone,
	"reward_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"fraud_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"xp_total" integer DEFAULT 0 NOT NULL,
	"points_balance" integer DEFAULT 0 NOT NULL,
	"points_earned_total" integer DEFAULT 0 NOT NULL,
	"points_redeemed_total" integer DEFAULT 0 NOT NULL,
	"points_expired_total" integer DEFAULT 0 NOT NULL,
	"current_streak_weeks" integer DEFAULT 0 NOT NULL,
	"longest_streak_weeks" integer DEFAULT 0 NOT NULL,
	"last_activity_date" date,
	"tier" "membership_tier" DEFAULT 'X1' NOT NULL,
	"badges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"tx_type" "rewards_tx_type" NOT NULL,
	"xp_delta" integer DEFAULT 0 NOT NULL,
	"points_delta" integer DEFAULT 0 NOT NULL,
	"points_balance_after" integer DEFAULT 0 NOT NULL,
	"session_id" uuid,
	"challenge_id" uuid,
	"coupon_id" uuid,
	"cost_to_company" numeric(14, 2) DEFAULT '0' NOT NULL,
	"expires_at" timestamp with time zone,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_key" varchar(60) NOT NULL,
	"plan_name_he" varchar(160) NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"monthly_price_gross" numeric(14, 2) DEFAULT '0' NOT NULL,
	"included_sessions_per_month" integer DEFAULT 0 NOT NULL,
	"used_sessions_this_period" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"club_id" uuid,
	"activity_type" "crm_activity_type" NOT NULL,
	"subject" varchar(250),
	"body" text,
	"from_stage" "lead_stage",
	"to_stage" "lead_stage",
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"performed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_name" varchar(200) NOT NULL,
	"club_id" uuid,
	"stage" "lead_stage" DEFAULT 'lead' NOT NULL,
	"city" varchar(100),
	"region" varchar(80),
	"court_count" integer,
	"audience_type" varchar(60),
	"off_peak_availability_hours" numeric(8, 6),
	"station_potential" integer,
	"contact_name" varchar(200),
	"contact_role" varchar(100),
	"contact_email" varchar(320),
	"contact_phone" varchar(32),
	"source" varchar(80),
	"owner_id" uuid,
	"close_probability" numeric(8, 6) DEFAULT '0' NOT NULL,
	"deal_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"expected_close_date" date,
	"next_follow_up_at" timestamp with time zone,
	"lost_reason" text,
	"lost_at" timestamp with time zone,
	"won_at" timestamp with time zone,
	"proposal_file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(250) NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"assignee_id" uuid,
	"created_by" uuid,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"entity_type" varchar(40),
	"entity_id" uuid,
	"club_id" uuid,
	"lead_id" uuid,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_he" varchar(200) NOT NULL,
	"media_type" "media_type" NOT NULL,
	"file_id" uuid,
	"external_url" text,
	"duration_seconds" integer,
	"width_px" integer,
	"height_px" integer,
	"is_user_generated" boolean DEFAULT false NOT NULL,
	"uploaded_by_user_id" uuid,
	"moderation_status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"moderated_by" uuid,
	"moderated_at" timestamp with time zone,
	"moderation_note" text,
	"consent_id" uuid,
	"rights_expire_at" timestamp with time zone,
	"report_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screen_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_he" varchar(200) NOT NULL,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	"playlist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cta_text" varchar(200),
	"cta_url" text,
	"qr_target" text,
	"target_club_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_regions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_screen_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"daily_from" time,
	"daily_until" time,
	"days_of_week" jsonb DEFAULT '[0,1,2,3,4,5,6]'::jsonb NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screen_playback_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"screen_id" uuid NOT NULL,
	"campaign_id" uuid,
	"media_asset_id" uuid,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" "audit_action" NOT NULL,
	"action_key" varchar(96) NOT NULL,
	"actor_user_id" uuid,
	"actor_name" varchar(200),
	"actor_role_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"impersonated_by_user_id" uuid,
	"entity_type" varchar(60) NOT NULL,
	"entity_id" uuid,
	"entity_label" varchar(250),
	"club_id" uuid,
	"before_value" jsonb,
	"after_value" jsonb,
	"reason" text,
	"amount" varchar(32),
	"approved_by_user_id" uuid,
	"ip_address" varchar(64),
	"user_agent" text,
	"auth_session_id" uuid,
	"request_id" varchar(64),
	"succeeded" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(80) NOT NULL,
	"name_he" varchar(250) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"severity" "notification_severity" DEFAULT 'warning' NOT NULL,
	"condition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"channels" jsonb DEFAULT '["in_app"]'::jsonb NOT NULL,
	"cooldown_minutes" integer DEFAULT 60 NOT NULL,
	"target_role_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"trigger_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(120) NOT NULL,
	"name_he" varchar(250) NOT NULL,
	"category" varchar(60) NOT NULL,
	"description" text,
	"value_type" "setting_value_type" NOT NULL,
	"unit" varchar(40),
	"confidence" "setting_confidence" DEFAULT 'assumed' NOT NULL,
	"source_reference" text,
	"conflicting_value" text,
	"conflicting_source" text,
	"is_scenario_scoped" boolean DEFAULT false NOT NULL,
	"allows_club_override" boolean DEFAULT false NOT NULL,
	"min_value" varchar(60),
	"max_value" varchar(60),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar(250) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"storage_provider" varchar(24) DEFAULT 'local' NOT NULL,
	"storage_path" text NOT NULL,
	"checksum" varchar(128),
	"entity_type" varchar(40),
	"entity_id" uuid,
	"uploaded_by" uuid,
	"retain_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(80) NOT NULL,
	"name_he" varchar(200) NOT NULL,
	"definition" text NOT NULL,
	"formula" text NOT NULL,
	"data_source" text NOT NULL,
	"owner_role" varchar(80) NOT NULL,
	"update_frequency" varchar(24) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"unit" varchar(40),
	"tooltip_he" text,
	"caution_he" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid,
	"severity" "notification_severity" DEFAULT 'info' NOT NULL,
	"title" varchar(250) NOT NULL,
	"body" text,
	"channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"recipient_user_id" uuid,
	"recipient_role_key" varchar(64),
	"entity_type" varchar(40),
	"entity_id" uuid,
	"club_id" uuid,
	"action_url" text,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"delivery_provider" varchar(40) DEFAULT 'mock' NOT NULL,
	"delivery_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" varchar(60) NOT NULL,
	"name_he" varchar(160) NOT NULL,
	"query_state" text NOT NULL,
	"visible_columns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setting_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setting_id" uuid NOT NULL,
	"scenario" "scenario",
	"club_id" uuid,
	"value" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_until" timestamp with time zone,
	"changed_by" uuid,
	"change_reason" text,
	"previous_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_impersonated_by_user_id_users_id_fk" FOREIGN KEY ("impersonated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_level_overridden_by_users_id_fk" FOREIGN KEY ("level_overridden_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_merged_into_user_id_users_id_fk" FOREIGN KEY ("merged_into_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_club_scopes" ADD CONSTRAINT "user_club_scopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_contacts" ADD CONSTRAINT "club_contacts_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_contracts" ADD CONSTRAINT "club_contracts_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_operating_hours" ADD CONSTRAINT "club_operating_hours_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_account_manager_id_users_id_fk" FOREIGN KEY ("account_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courts" ADD CONSTRAINT "courts_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screens" ADD CONSTRAINT "screens_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screens" ADD CONSTRAINT "screens_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_suspended_by_users_id_fk" FOREIGN KEY ("suspended_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_firmware_history" ADD CONSTRAINT "device_firmware_history_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_firmware_history" ADD CONSTRAINT "device_firmware_history_from_version_id_firmware_versions_id_fk" FOREIGN KEY ("from_version_id") REFERENCES "public"."firmware_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_firmware_history" ADD CONSTRAINT "device_firmware_history_to_version_id_firmware_versions_id_fk" FOREIGN KEY ("to_version_id") REFERENCES "public"."firmware_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_firmware_history" ADD CONSTRAINT "device_firmware_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_telemetry" ADD CONSTRAINT "device_telemetry_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_current_club_id_clubs_id_fk" FOREIGN KEY ("current_club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_current_station_id_stations_id_fk" FOREIGN KEY ("current_station_id") REFERENCES "public"."stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_quarantined_by_users_id_fk" FOREIGN KEY ("quarantined_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_bookings" ADD CONSTRAINT "court_bookings_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_bookings" ADD CONSTRAINT "court_bookings_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_bookings" ADD CONSTRAINT "court_bookings_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_bookings" ADD CONSTRAINT "court_bookings_classified_by_users_id_fk" FOREIGN KEY ("classified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_players" ADD CONSTRAINT "session_players_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_players" ADD CONSTRAINT "session_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chargebacks" ADD CONSTRAINT "chargebacks_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_credit_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."credit_wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_sla_policy_id_sla_policies_id_fk" FOREIGN KEY ("sla_policy_id") REFERENCES "public"."sla_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_replacement_device_id_devices_id_fk" FOREIGN KEY ("replacement_device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_id_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_submissions" ADD CONSTRAINT "checklist_submissions_checklist_id_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_submissions" ADD CONSTRAINT "checklist_submissions_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_submissions" ADD CONSTRAINT "checklist_submissions_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_submissions" ADD CONSTRAINT "checklist_submissions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_submissions" ADD CONSTRAINT "checklist_submissions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_plan_id_maintenance_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."maintenance_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_from_location_id_inventory_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_to_location_id_inventory_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_maintenance_task_id_maintenance_tasks_id_fk" FOREIGN KEY ("maintenance_task_id") REFERENCES "public"."maintenance_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earn_back_adjustments" ADD CONSTRAINT "earn_back_adjustments_agreement_id_earn_back_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."earn_back_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earn_back_adjustments" ADD CONSTRAINT "earn_back_adjustments_measurement_id_earn_back_measurements_id_fk" FOREIGN KEY ("measurement_id") REFERENCES "public"."earn_back_measurements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earn_back_adjustments" ADD CONSTRAINT "earn_back_adjustments_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earn_back_agreements" ADD CONSTRAINT "earn_back_agreements_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earn_back_agreements" ADD CONSTRAINT "earn_back_agreements_contract_id_club_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."club_contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earn_back_conditions" ADD CONSTRAINT "earn_back_conditions_agreement_id_earn_back_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."earn_back_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earn_back_conditions" ADD CONSTRAINT "earn_back_conditions_waived_by_users_id_fk" FOREIGN KEY ("waived_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earn_back_measurements" ADD CONSTRAINT "earn_back_measurements_agreement_id_earn_back_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."earn_back_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earn_back_measurements" ADD CONSTRAINT "earn_back_measurements_calculated_by_users_id_fk" FOREIGN KEY ("calculated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_attributions" ADD CONSTRAINT "coach_attributions_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_attributions" ADD CONSTRAINT "coach_attributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_commissions" ADD CONSTRAINT "coach_commissions_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_commissions" ADD CONSTRAINT "coach_commissions_attribution_id_coach_attributions_id_fk" FOREIGN KEY ("attribution_id") REFERENCES "public"."coach_attributions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_commissions" ADD CONSTRAINT "coach_commissions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_commissions" ADD CONSTRAINT "coach_commissions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_home_club_id_clubs_id_fk" FOREIGN KEY ("home_club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drill_versions" ADD CONSTRAINT "drill_versions_drill_id_drills_id_fk" FOREIGN KEY ("drill_id") REFERENCES "public"."drills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drill_versions" ADD CONSTRAINT "drill_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drills" ADD CONSTRAINT "drills_created_by_coach_id_coaches_id_fk" FOREIGN KEY ("created_by_coach_id") REFERENCES "public"."coaches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drills" ADD CONSTRAINT "drills_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_versions" ADD CONSTRAINT "program_versions_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_versions" ADD CONSTRAINT "program_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_created_by_coach_id_coaches_id_fk" FOREIGN KEY ("created_by_coach_id") REFERENCES "public"."coaches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards_accounts" ADD CONSTRAINT "rewards_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards_transactions" ADD CONSTRAINT "rewards_transactions_account_id_rewards_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."rewards_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards_transactions" ADD CONSTRAINT "rewards_transactions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards_transactions" ADD CONSTRAINT "rewards_transactions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards_transactions" ADD CONSTRAINT "rewards_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screen_campaigns" ADD CONSTRAINT "screen_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screen_playback_logs" ADD CONSTRAINT "screen_playback_logs_screen_id_screens_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."screens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screen_playback_logs" ADD CONSTRAINT "screen_playback_logs_campaign_id_screen_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."screen_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screen_playback_logs" ADD CONSTRAINT "screen_playback_logs_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_impersonated_by_user_id_users_id_fk" FOREIGN KEY ("impersonated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_rule_id_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setting_versions" ADD CONSTRAINT "setting_versions_setting_id_business_settings_id_fk" FOREIGN KEY ("setting_id") REFERENCES "public"."business_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setting_versions" ADD CONSTRAINT "setting_versions_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setting_versions" ADD CONSTRAINT "setting_versions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expiry_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "consents_user_idx" ON "consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "consents_type_idx" ON "consents" USING btree ("consent_type");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "permissions_category_idx" ON "permissions" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "player_profiles_user_key" ON "player_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "player_profiles_level_idx" ON "player_profiles" USING btree ("level");--> statement-breakpoint
CREATE INDEX "player_profiles_club_idx" ON "player_profiles" USING btree ("preferred_club_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_key" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_key_key" ON "roles" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_profiles_user_key" ON "staff_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_club_scopes_key" ON "user_club_scopes" USING btree ("user_id","club_id");--> statement-breakpoint
CREATE INDEX "user_club_scopes_club_idx" ON "user_club_scopes" USING btree ("club_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_key" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "user_roles_user_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_key" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_name_idx" ON "users" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "club_contacts_club_idx" ON "club_contacts" USING btree ("club_id");--> statement-breakpoint
CREATE UNIQUE INDEX "club_contracts_number_key" ON "club_contracts" USING btree ("contract_number");--> statement-breakpoint
CREATE INDEX "club_contracts_club_idx" ON "club_contracts" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_contracts_status_idx" ON "club_contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "club_contracts_renewal_idx" ON "club_contracts" USING btree ("renewal_date");--> statement-breakpoint
CREATE UNIQUE INDEX "club_hours_key" ON "club_operating_hours" USING btree ("club_id","day_of_week");--> statement-breakpoint
CREATE UNIQUE INDEX "clubs_code_key" ON "clubs" USING btree ("code");--> statement-breakpoint
CREATE INDEX "clubs_status_idx" ON "clubs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "clubs_region_idx" ON "clubs" USING btree ("region");--> statement-breakpoint
CREATE INDEX "clubs_name_idx" ON "clubs" USING btree ("name");--> statement-breakpoint
CREATE INDEX "courts_club_idx" ON "courts" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "screens_club_idx" ON "screens" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "screens_station_idx" ON "screens" USING btree ("station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stations_code_key" ON "stations" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "stations_qr_key" ON "stations" USING btree ("qr_code_token");--> statement-breakpoint
CREATE INDEX "stations_club_idx" ON "stations" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "stations_status_idx" ON "stations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "device_assignments_device_idx" ON "device_assignments" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "device_assignments_station_idx" ON "device_assignments" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "device_assignments_period_idx" ON "device_assignments" USING btree ("assigned_at","unassigned_at");--> statement-breakpoint
CREATE INDEX "device_fw_history_device_idx" ON "device_firmware_history" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "device_telemetry_device_time_idx" ON "device_telemetry" USING btree ("device_id","recorded_at");--> statement-breakpoint
CREATE INDEX "device_telemetry_session_idx" ON "device_telemetry" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "device_telemetry_error_idx" ON "device_telemetry" USING btree ("error_code");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_device_id_key" ON "devices" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_serial_key" ON "devices" USING btree ("serial_number");--> statement-breakpoint
CREATE INDEX "devices_status_idx" ON "devices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "devices_club_idx" ON "devices" USING btree ("current_club_id");--> statement-breakpoint
CREATE INDEX "devices_station_idx" ON "devices" USING btree ("current_station_id");--> statement-breakpoint
CREATE INDEX "devices_connectivity_idx" ON "devices" USING btree ("connectivity");--> statement-breakpoint
CREATE INDEX "devices_next_service_idx" ON "devices" USING btree ("next_service_due");--> statement-breakpoint
CREATE UNIQUE INDEX "firmware_versions_key" ON "firmware_versions" USING btree ("version","channel");--> statement-breakpoint
CREATE INDEX "court_bookings_club_time_idx" ON "court_bookings" USING btree ("club_id","starts_at");--> statement-breakpoint
CREATE INDEX "court_bookings_session_idx" ON "court_bookings" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "court_bookings_link_type_idx" ON "court_bookings" USING btree ("link_type");--> statement-breakpoint
CREATE UNIQUE INDEX "court_bookings_external_key" ON "court_bookings" USING btree ("club_id","external_booking_id");--> statement-breakpoint
CREATE INDEX "session_events_session_time_idx" ON "session_events" USING btree ("session_id","occurred_at");--> statement-breakpoint
CREATE INDEX "session_events_type_idx" ON "session_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "session_players_slot_key" ON "session_players" USING btree ("session_id","slot");--> statement-breakpoint
CREATE INDEX "session_players_user_idx" ON "session_players" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_reference_key" ON "sessions" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "sessions_status_idx" ON "sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sessions_club_started_idx" ON "sessions" USING btree ("club_id","started_at");--> statement-breakpoint
CREATE INDEX "sessions_station_started_idx" ON "sessions" USING btree ("station_id","started_at");--> statement-breakpoint
CREATE INDEX "sessions_device_idx" ON "sessions" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_started_idx" ON "sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "sessions_coach_idx" ON "sessions" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "sessions_created_idx" ON "sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chargebacks_payment_idx" ON "chargebacks" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "coupons_active_idx" ON "coupons" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "coupons_validity_idx" ON "coupons" USING btree ("valid_from","valid_until");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_wallets_user_key" ON "credit_wallets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_club_idx" ON "invoices" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "invoices_type_idx" ON "invoices" USING btree ("invoice_type");--> statement-breakpoint
CREATE INDEX "invoices_due_idx" ON "invoices" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "payment_attempts_payment_idx" ON "payment_attempts" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_reference_key" ON "payments" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_key" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payments_session_idx" ON "payments" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_club_captured_idx" ON "payments" USING btree ("club_id","captured_at");--> statement-breakpoint
CREATE INDEX "payments_provider_tx_idx" ON "payments" USING btree ("provider_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_reference_key" ON "refunds" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_idempotency_key" ON "refunds" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "refunds_payment_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "refunds_session_idx" ON "refunds" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "refunds_status_idx" ON "refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refunds_reason_idx" ON "refunds" USING btree ("reason");--> statement-breakpoint
CREATE UNIQUE INDEX "settlements_key" ON "settlements" USING btree ("provider","settlement_date");--> statement-breakpoint
CREATE INDEX "settlements_date_idx" ON "settlements" USING btree ("settlement_date");--> statement-breakpoint
CREATE INDEX "wallet_tx_wallet_idx" ON "wallet_transactions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "wallet_tx_type_idx" ON "wallet_transactions" USING btree ("tx_type");--> statement-breakpoint
CREATE INDEX "sla_policies_default_idx" ON "sla_policies" USING btree ("is_default");--> statement-breakpoint
CREATE UNIQUE INDEX "support_tickets_reference_key" ON "support_tickets" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "support_tickets_severity_idx" ON "support_tickets" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "support_tickets_club_idx" ON "support_tickets" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "support_tickets_device_idx" ON "support_tickets" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "support_tickets_station_idx" ON "support_tickets" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "support_tickets_assignee_idx" ON "support_tickets" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "support_tickets_resolution_due_idx" ON "support_tickets" USING btree ("resolution_due_at");--> statement-breakpoint
CREATE INDEX "support_tickets_created_idx" ON "support_tickets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ticket_events_ticket_time_idx" ON "ticket_events" USING btree ("ticket_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_items_order_key" ON "checklist_items" USING btree ("checklist_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_submissions_key" ON "checklist_submissions" USING btree ("checklist_id","station_id","for_date");--> statement-breakpoint
CREATE INDEX "checklist_submissions_club_date_idx" ON "checklist_submissions" USING btree ("club_id","for_date");--> statement-breakpoint
CREATE INDEX "checklist_submissions_status_idx" ON "checklist_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "checklists_frequency_idx" ON "checklists" USING btree ("frequency");--> statement-breakpoint
CREATE INDEX "maintenance_plans_trigger_idx" ON "maintenance_plans" USING btree ("trigger");--> statement-breakpoint
CREATE UNIQUE INDEX "maintenance_tasks_reference_key" ON "maintenance_tasks" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "maintenance_tasks_device_idx" ON "maintenance_tasks" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "maintenance_tasks_status_due_idx" ON "maintenance_tasks" USING btree ("status","due_on");--> statement-breakpoint
CREATE INDEX "maintenance_tasks_club_idx" ON "maintenance_tasks" USING btree ("club_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_sku_key" ON "inventory_items" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "inventory_items_category_idx" ON "inventory_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "inventory_items_reorder_idx" ON "inventory_items" USING btree ("quantity_on_hand","reorder_point");--> statement-breakpoint
CREATE INDEX "inventory_locations_type_idx" ON "inventory_locations" USING btree ("location_type");--> statement-breakpoint
CREATE INDEX "inventory_locations_club_idx" ON "inventory_locations" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_item_time_idx" ON "inventory_movements" USING btree ("item_id","occurred_at");--> statement-breakpoint
CREATE INDEX "inventory_movements_type_idx" ON "inventory_movements" USING btree ("movement_type");--> statement-breakpoint
CREATE INDEX "inventory_movements_ticket_idx" ON "inventory_movements" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "earn_back_adjustments_agreement_idx" ON "earn_back_adjustments" USING btree ("agreement_id");--> statement-breakpoint
CREATE INDEX "earn_back_club_idx" ON "earn_back_agreements" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "earn_back_status_idx" ON "earn_back_agreements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "earn_back_period_idx" ON "earn_back_agreements" USING btree ("starts_on","ends_on");--> statement-breakpoint
CREATE UNIQUE INDEX "earn_back_conditions_key" ON "earn_back_conditions" USING btree ("agreement_id","condition_key");--> statement-breakpoint
CREATE INDEX "earn_back_conditions_status_idx" ON "earn_back_conditions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "earn_back_measurements_key" ON "earn_back_measurements" USING btree ("agreement_id","period_start");--> statement-breakpoint
CREATE INDEX "earn_back_measurements_agreement_idx" ON "earn_back_measurements" USING btree ("agreement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_attributions_key" ON "coach_attributions" USING btree ("coach_id","user_id","attribution_type");--> statement-breakpoint
CREATE INDEX "coach_attributions_user_idx" ON "coach_attributions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "coach_attributions_coach_idx" ON "coach_attributions" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "coach_commissions_coach_idx" ON "coach_commissions" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "coach_commissions_status_idx" ON "coach_commissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "coach_commissions_session_idx" ON "coach_commissions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "coach_commissions_accrued_idx" ON "coach_commissions" USING btree ("accrued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coaches_user_key" ON "coaches" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coaches_referral_code_key" ON "coaches" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "coaches_verification_idx" ON "coaches" USING btree ("verification");--> statement-breakpoint
CREATE INDEX "coaches_club_idx" ON "coaches" USING btree ("home_club_id");--> statement-breakpoint
CREATE INDEX "homework_coach_idx" ON "homework_assignments" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "homework_user_idx" ON "homework_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "homework_due_idx" ON "homework_assignments" USING btree ("due_on");--> statement-breakpoint
CREATE UNIQUE INDEX "drill_versions_key" ON "drill_versions" USING btree ("drill_id","version_number");--> statement-breakpoint
CREATE INDEX "drill_versions_status_idx" ON "drill_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "drill_versions_level_idx" ON "drill_versions" USING btree ("level");--> statement-breakpoint
CREATE UNIQUE INDEX "drills_slug_key" ON "drills" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "drills_type_idx" ON "drills" USING btree ("drill_type");--> statement-breakpoint
CREATE UNIQUE INDEX "program_versions_key" ON "program_versions" USING btree ("program_id","version_number");--> statement-breakpoint
CREATE INDEX "program_versions_status_idx" ON "program_versions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "programs_slug_key" ON "programs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "challenges_status_idx" ON "challenges" USING btree ("status");--> statement-breakpoint
CREATE INDEX "challenges_period_idx" ON "challenges" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE INDEX "referrals_code_idx" ON "referrals" USING btree ("code");--> statement-breakpoint
CREATE INDEX "referrals_status_idx" ON "referrals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "rewards_accounts_user_key" ON "rewards_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rewards_tx_account_idx" ON "rewards_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "rewards_tx_type_idx" ON "rewards_transactions" USING btree ("tx_type");--> statement-breakpoint
CREATE INDEX "rewards_tx_created_idx" ON "rewards_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "rewards_tx_expiry_idx" ON "rewards_transactions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "crm_activities_lead_time_idx" ON "crm_activities" USING btree ("lead_id","occurred_at");--> statement-breakpoint
CREATE INDEX "crm_activities_club_idx" ON "crm_activities" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "leads_stage_idx" ON "leads" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "leads_owner_idx" ON "leads" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "leads_follow_up_idx" ON "leads" USING btree ("next_follow_up_at");--> statement-breakpoint
CREATE INDEX "leads_name_idx" ON "leads" USING btree ("club_name");--> statement-breakpoint
CREATE INDEX "tasks_assignee_status_idx" ON "tasks" USING btree ("assignee_id","status");--> statement-breakpoint
CREATE INDEX "tasks_due_idx" ON "tasks" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "tasks_entity_idx" ON "tasks" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "tasks_club_idx" ON "tasks" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "media_assets_moderation_idx" ON "media_assets" USING btree ("moderation_status");--> statement-breakpoint
CREATE INDEX "media_assets_ugc_idx" ON "media_assets" USING btree ("is_user_generated");--> statement-breakpoint
CREATE INDEX "media_assets_rights_idx" ON "media_assets" USING btree ("rights_expire_at");--> statement-breakpoint
CREATE INDEX "screen_campaigns_status_idx" ON "screen_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "screen_campaigns_period_idx" ON "screen_campaigns" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "screen_playback_screen_time_idx" ON "screen_playback_logs" USING btree ("screen_id","played_at");--> statement-breakpoint
CREATE INDEX "screen_playback_campaign_idx" ON "screen_playback_logs" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action_key");--> statement-breakpoint
CREATE INDEX "audit_logs_time_idx" ON "audit_logs" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_club_idx" ON "audit_logs" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "audit_logs_request_idx" ON "audit_logs" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_rules_key_key" ON "automation_rules" USING btree ("key");--> statement-breakpoint
CREATE INDEX "automation_rules_active_idx" ON "automation_rules" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "business_settings_key_key" ON "business_settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "business_settings_category_idx" ON "business_settings" USING btree ("category");--> statement-breakpoint
CREATE INDEX "files_entity_idx" ON "files" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "files_uploader_idx" ON "files" USING btree ("uploaded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_definitions_key_key" ON "metric_definitions" USING btree ("key","version");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_user_id","status");--> statement-breakpoint
CREATE INDEX "notifications_role_idx" ON "notifications" USING btree ("recipient_role_key","status");--> statement-breakpoint
CREATE INDEX "notifications_entity_idx" ON "notifications" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_severity_idx" ON "notifications" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "saved_views_user_scope_idx" ON "saved_views" USING btree ("user_id","scope");--> statement-breakpoint
CREATE INDEX "setting_versions_setting_idx" ON "setting_versions" USING btree ("setting_id");--> statement-breakpoint
CREATE INDEX "setting_versions_effective_idx" ON "setting_versions" USING btree ("setting_id","effective_from");--> statement-breakpoint
CREATE INDEX "setting_versions_club_idx" ON "setting_versions" USING btree ("club_id");