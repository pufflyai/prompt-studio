CREATE TABLE "manager_team_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"email" text NOT NULL,
	"digest" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"state" text NOT NULL,
	"acceptedBy" text,
	CONSTRAINT "manager_team_invitations_digest_unique" UNIQUE("digest")
);
--> statement-breakpoint
ALTER TABLE "manager_team_invitations" ADD CONSTRAINT "manager_team_invitations_accountId_manager_teams_accountId_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_teams"("accountId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_team_invitations" ADD CONSTRAINT "manager_team_invitations_acceptedBy_manager_accounts_id_fk" FOREIGN KEY ("acceptedBy") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manager_team_invitations_by_team" ON "manager_team_invitations" USING btree ("accountId","email");