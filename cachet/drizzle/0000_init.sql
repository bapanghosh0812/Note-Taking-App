CREATE TYPE "public"."access_type" AS ENUM('public', 'password');--> statement-breakpoint
CREATE TYPE "public"."share_type" AS ENUM('one_time', 'time_based');--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notes_content_length" CHECK (char_length("notes"."content") <= 50000)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" varchar(200) PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" varchar(256),
	"ip_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"token_prefix" varchar(8) NOT NULL,
	"label" varchar(60),
	"share_type" "share_type" NOT NULL,
	"access_type" "access_type" NOT NULL,
	"key_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_view_count_non_negative" CHECK ("share_links"."view_count" >= 0),
	CONSTRAINT "share_links_one_time_single_view" CHECK ("share_links"."share_type" <> 'one_time' OR "share_links"."view_count" <= 1),
	CONSTRAINT "share_links_key_matches_access" CHECK (("share_links"."access_type" = 'password') = ("share_links"."key_hash" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "share_views" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"link_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"method" "access_type" NOT NULL,
	"ip_hash" varchar(64),
	"user_agent" varchar(256),
	"country" varchar(2)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"name" varchar(80) NOT NULL,
	"password_hash" text NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_views" ADD CONSTRAINT "share_views_link_id_share_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_owner_updated_idx" ON "notes" USING btree ("owner_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "share_links_token_hash_key" ON "share_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "share_links_note_id_idx" ON "share_links" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "share_views_link_viewed_idx" ON "share_views" USING btree ("link_id","viewed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");