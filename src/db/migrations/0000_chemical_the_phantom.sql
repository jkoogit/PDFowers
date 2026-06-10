CREATE TABLE "account_merge_request" (
	"merge_request_uuid" uuid PRIMARY KEY NOT NULL,
	"request_user_uuid" uuid NOT NULL,
	"target_user_uuid" uuid NOT NULL,
	"provider_cd" varchar(50) NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"merge_status_cd" varchar(50) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_sys" varchar(50) DEFAULT 'pdfowers' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(100) DEFAULT 'system' NOT NULL,
	"updated_sys" varchar(50) DEFAULT 'pdfowers' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(100) DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"audit_log_uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_uuid" uuid,
	"audit_event_type_cd" varchar(100) NOT NULL,
	"target_type_cd" varchar(50),
	"target_uuid" uuid,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_identity" (
	"auth_identity_uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_uuid" uuid NOT NULL,
	"provider_cd" varchar(50) NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"email_from_provider" varchar(320),
	"connected_at" timestamp with time zone NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_sys" varchar(50) DEFAULT 'pdfowers' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(100) DEFAULT 'system' NOT NULL,
	"updated_sys" varchar(50) DEFAULT 'pdfowers' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(100) DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job" (
	"job_uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type_cd" varchar(100) NOT NULL,
	"job_status_cd" varchar(50) NOT NULL,
	"payload_json" jsonb NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_reason" text,
	"created_sys" varchar(50) DEFAULT 'pdfowers' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(100) DEFAULT 'system' NOT NULL,
	"updated_sys" varchar(50) DEFAULT 'pdfowers' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(100) DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_credential" (
	"user_uuid" uuid PRIMARY KEY NOT NULL,
	"login_id" varchar(100) NOT NULL,
	"password_hash" text NOT NULL,
	"password_hash_alg_cd" varchar(50) NOT NULL,
	"created_sys" varchar(50) DEFAULT 'pdfowers' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(100) DEFAULT 'system' NOT NULL,
	"updated_sys" varchar(50) DEFAULT 'pdfowers' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(100) DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_account" (
	"user_uuid" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"primary_email" varchar(320) NOT NULL,
	"user_status_cd" varchar(50) NOT NULL,
	"merged_into_user_uuid" uuid,
	"created_sys" varchar(50) DEFAULT 'pdfowers' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(100) DEFAULT 'system' NOT NULL,
	"updated_sys" varchar(50) DEFAULT 'pdfowers' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(100) DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verified_email" (
	"verified_email_uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_uuid" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"email_verified_at" timestamp with time zone,
	"email_notification_opt_in" boolean DEFAULT false NOT NULL,
	"created_sys" varchar(50) DEFAULT 'pdfowers' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(100) DEFAULT 'system' NOT NULL,
	"updated_sys" varchar(50) DEFAULT 'pdfowers' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(100) DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_merge_request" ADD CONSTRAINT "account_merge_request_request_user_uuid_user_account_user_uuid_fk" FOREIGN KEY ("request_user_uuid") REFERENCES "public"."user_account"("user_uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_merge_request" ADD CONSTRAINT "account_merge_request_target_user_uuid_user_account_user_uuid_fk" FOREIGN KEY ("target_user_uuid") REFERENCES "public"."user_account"("user_uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_identity" ADD CONSTRAINT "auth_identity_user_uuid_user_account_user_uuid_fk" FOREIGN KEY ("user_uuid") REFERENCES "public"."user_account"("user_uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_credential" ADD CONSTRAINT "local_credential_user_uuid_user_account_user_uuid_fk" FOREIGN KEY ("user_uuid") REFERENCES "public"."user_account"("user_uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_email" ADD CONSTRAINT "verified_email_user_uuid_user_account_user_uuid_fk" FOREIGN KEY ("user_uuid") REFERENCES "public"."user_account"("user_uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identity_provider_user_uidx" ON "auth_identity" USING btree ("provider_cd","provider_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "local_credential_login_id_uidx" ON "local_credential" USING btree ("login_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verified_email_email_uidx" ON "verified_email" USING btree ("email");