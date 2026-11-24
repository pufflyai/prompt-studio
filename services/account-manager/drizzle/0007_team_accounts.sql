CREATE TABLE "manager_project_members" (
	"accountId" text NOT NULL,
	"workbenchId" text NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "manager_project_members_accountId_workbenchId_userId_pk" PRIMARY KEY("accountId","workbenchId","userId")
);
--> statement-breakpoint
CREATE TABLE "manager_team_members" (
	"accountId" text NOT NULL,
	"userId" text NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "manager_team_members_accountId_userId_pk" PRIMARY KEY("accountId","userId")
);
--> statement-breakpoint
CREATE TABLE "manager_teams" (
	"accountId" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manager_space_keys" DROP CONSTRAINT "manager_space_keys_accountId_workbenchId_space_generation_pk";--> statement-breakpoint
ALTER TABLE "manager_accounts" ALTER COLUMN "ownerIssuer" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "manager_accounts" ALTER COLUMN "ownerSubject" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "manager_space_keys" ADD COLUMN "ownerId" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "manager_project_members" ADD CONSTRAINT "manager_project_members_accountId_workbenchId_manager_workbenches_accountId_id_fk" FOREIGN KEY ("accountId","workbenchId") REFERENCES "public"."manager_workbenches"("accountId","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_project_members" ADD CONSTRAINT "manager_project_members_accountId_userId_manager_team_members_accountId_userId_fk" FOREIGN KEY ("accountId","userId") REFERENCES "public"."manager_team_members"("accountId","userId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_team_members" ADD CONSTRAINT "manager_team_members_accountId_manager_teams_accountId_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_teams"("accountId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_team_members" ADD CONSTRAINT "manager_team_members_userId_manager_accounts_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_teams" ADD CONSTRAINT "manager_teams_accountId_manager_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manager_project_grants_by_user" ON "manager_project_members" USING btree ("accountId","userId","workbenchId");--> statement-breakpoint
CREATE UNIQUE INDEX "manager_one_team_owner" ON "manager_team_members" USING btree ("accountId") WHERE "manager_team_members"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "manager_teams_by_user" ON "manager_team_members" USING btree ("userId","accountId");--> statement-breakpoint
CREATE UNIQUE INDEX "manager_space_key_generation" ON "manager_space_keys" USING btree ("accountId","workbenchId","space","ownerId","generation");--> statement-breakpoint
CREATE INDEX "manager_space_keys_by_user" ON "manager_space_keys" USING btree ("ownerId","accountId");