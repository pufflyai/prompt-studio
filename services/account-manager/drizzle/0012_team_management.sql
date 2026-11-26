CREATE TABLE "manager_team_extension_policies" (
	"accountId" text NOT NULL,
	"extensionId" text NOT NULL,
	"selectionId" text NOT NULL,
	"packageId" text,
	CONSTRAINT "manager_team_extension_policies_accountId_extensionId_pk" PRIMARY KEY("accountId","extensionId")
);
--> statement-breakpoint
CREATE TABLE "manager_team_managed_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"descriptor" jsonb NOT NULL,
	"uploadId" text,
	"state" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manager_team_invitations" DROP CONSTRAINT "manager_team_invitation_recipient";--> statement-breakpoint
ALTER TABLE "manager_team_extension_policies" ADD CONSTRAINT "manager_team_extension_policies_accountId_manager_teams_accountId_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_teams"("accountId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_team_extension_policies" ADD CONSTRAINT "manager_team_extension_policies_packageId_accountId_manager_team_managed_packages_id_accountId_fk" FOREIGN KEY ("packageId","accountId") REFERENCES "public"."manager_team_managed_packages"("id","accountId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_team_managed_packages" ADD CONSTRAINT "manager_team_managed_packages_accountId_manager_teams_accountId_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_teams"("accountId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manager_team_package_cleanup" ON "manager_team_managed_packages" USING btree ("createdAt","id");--> statement-breakpoint
CREATE UNIQUE INDEX "manager_team_package_owner" ON "manager_team_managed_packages" USING btree ("id","accountId");--> statement-breakpoint
ALTER TABLE "manager_team_invitations" ADD CONSTRAINT "manager_team_invitation_recipient" CHECK (("manager_team_invitations"."email" is not null and "manager_team_invitations"."microsoftTenantId" is null and "manager_team_invitations"."microsoftObjectId" is null)
        or ("manager_team_invitations"."email" is null and "manager_team_invitations"."microsoftTenantId" is not null and "manager_team_invitations"."microsoftObjectId" is not null)
        or ("manager_team_invitations"."email" is null and "manager_team_invitations"."microsoftTenantId" is null and "manager_team_invitations"."microsoftObjectId" is null));