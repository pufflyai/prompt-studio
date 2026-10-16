CREATE TABLE "manager_login_challenges" (
	"stateDigest" text PRIMARY KEY NOT NULL,
	"bindingDigest" text NOT NULL,
	"nonce" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manager_owner_sessions" (
	"digest" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manager_owner_sessions" ADD CONSTRAINT "manager_owner_sessions_accountId_manager_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;