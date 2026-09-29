ALTER TABLE "users" ADD COLUMN "avatar_image" "bytea";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_mime" varchar(16);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_updated_at" timestamp with time zone;