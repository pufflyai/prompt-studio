CREATE TABLE "manager_team_ownership_offers" (
	"accountId" text PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"ownerUserId" text NOT NULL,
	"recipientUserId" text NOT NULL,
	"state" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manager_team_ownership_offers" ADD CONSTRAINT "manager_team_ownership_offers_accountId_manager_teams_accountId_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_teams"("accountId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_team_ownership_offers" ADD CONSTRAINT "manager_team_ownership_offers_ownerUserId_manager_accounts_id_fk" FOREIGN KEY ("ownerUserId") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_team_ownership_offers" ADD CONSTRAINT "manager_team_ownership_offers_recipientUserId_manager_accounts_id_fk" FOREIGN KEY ("recipientUserId") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;