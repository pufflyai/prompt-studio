CREATE TABLE "relay_acknowledgements" (
	"id" text PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"ack" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relay_captures" (
	"id" text PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"snapshotHash" text NOT NULL,
	"references" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "relay_scopes" ADD COLUMN "generation" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "relay_scopes" ADD COLUMN "covered" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "relay_scopes" ADD COLUMN "writers" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "relay_scopes" ADD COLUMN "documents" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "relay_acknowledgements" ADD CONSTRAINT "relay_acknowledgements_ownerId_relay_scopes_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."relay_scopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relay_captures" ADD CONSTRAINT "relay_captures_ownerId_relay_scopes_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."relay_scopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "relay_operations_writer_position" ON "relay_operations" USING btree ("ownerId",("mutation"->>'epoch'),("mutation"->>'generation'),("mutation"->>'environmentId'),("mutation"->>'sequence'));