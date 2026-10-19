CREATE TABLE "manager_devices" (
	"accountId" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"platform" text NOT NULL,
	"digest" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSeenAt" timestamp with time zone DEFAULT now() NOT NULL,
	"removedAt" timestamp with time zone,
	CONSTRAINT "manager_devices_accountId_id_pk" PRIMARY KEY("accountId","id")
);
--> statement-breakpoint
DROP TABLE "manager_credentials" CASCADE;--> statement-breakpoint
ALTER TABLE "manager_devices" ADD CONSTRAINT "manager_devices_accountId_manager_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "manager_devices_digest" ON "manager_devices" USING btree ("digest");--> statement-breakpoint
-- Per-project grant results no longer match any request kind; devices log in again instead.
DELETE FROM "manager_requests" WHERE "result" ? 'workbenchId';
