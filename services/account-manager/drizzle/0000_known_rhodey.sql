CREATE TABLE "manager_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"ownerIssuer" text NOT NULL,
	"ownerSubject" text NOT NULL,
	"state" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manager_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"workbenchId" text NOT NULL,
	"environmentId" text NOT NULL,
	"digest" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"revokedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "manager_requests" (
	"accountId" text NOT NULL,
	"id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"result" jsonb NOT NULL,
	CONSTRAINT "manager_requests_accountId_id_pk" PRIMARY KEY("accountId","id")
);
--> statement-breakpoint
CREATE TABLE "manager_restore_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manager_workbenches" (
	"accountId" text NOT NULL,
	"id" text NOT NULL,
	CONSTRAINT "manager_workbenches_accountId_id_pk" PRIMARY KEY("accountId","id")
);
--> statement-breakpoint
ALTER TABLE "manager_credentials" ADD CONSTRAINT "manager_credentials_accountId_workbenchId_manager_workbenches_accountId_id_fk" FOREIGN KEY ("accountId","workbenchId") REFERENCES "public"."manager_workbenches"("accountId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_requests" ADD CONSTRAINT "manager_requests_accountId_manager_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_workbenches" ADD CONSTRAINT "manager_workbenches_accountId_manager_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "manager_credentials_digest" ON "manager_credentials" USING btree ("digest");--> statement-breakpoint
CREATE INDEX "manager_credentials_account_environment" ON "manager_credentials" USING btree ("accountId","environmentId");