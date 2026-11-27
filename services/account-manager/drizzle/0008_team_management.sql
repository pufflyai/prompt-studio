CREATE TABLE "manager_google_identity_claims" (
	"subject" text PRIMARY KEY NOT NULL,
	"issuedAt" integer NOT NULL,
	"verifiedEmail" text
);
--> statement-breakpoint
CREATE TABLE "manager_microsoft_identity_claims" (
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"tenantId" text NOT NULL,
	"objectId" text NOT NULL,
	CONSTRAINT "manager_microsoft_identity_claims_issuer_subject_pk" PRIMARY KEY("issuer","subject")
);
--> statement-breakpoint
CREATE TABLE "manager_team_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"email" text,
	"microsoftTenantId" text,
	"microsoftObjectId" text,
	"digest" text NOT NULL,
	"issuedAt" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"state" text NOT NULL,
	"acceptedBy" text,
	CONSTRAINT "manager_team_invitations_digest_unique" UNIQUE("digest"),
	CONSTRAINT "manager_team_invitation_recipient" CHECK (("manager_team_invitations"."email" is not null and "manager_team_invitations"."microsoftTenantId" is null and "manager_team_invitations"."microsoftObjectId" is null)
        or ("manager_team_invitations"."email" is null and "manager_team_invitations"."microsoftTenantId" is not null and "manager_team_invitations"."microsoftObjectId" is not null)
        or ("manager_team_invitations"."email" is null and "manager_team_invitations"."microsoftTenantId" is null and "manager_team_invitations"."microsoftObjectId" is null))
);
--> statement-breakpoint
CREATE TABLE "manager_team_member_revocations" (
	"accountId" text NOT NULL,
	"userId" text NOT NULL,
	"revokedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "manager_team_member_revocations_accountId_userId_pk" PRIMARY KEY("accountId","userId")
);
--> statement-breakpoint
CREATE TABLE "manager_team_ownership_offers" (
	"accountId" text PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"ownerUserId" text NOT NULL,
	"recipientUserId" text NOT NULL,
	"state" text NOT NULL
);
--> statement-breakpoint
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
	"createdAt" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "manager_team_package_owner" UNIQUE("id","accountId")
);
--> statement-breakpoint
ALTER TABLE "manager_project_deletions" ADD COLUMN "requestedBy" text;--> statement-breakpoint
ALTER TABLE "manager_project_members" ADD COLUMN "grantId" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "manager_team_invitations" ADD CONSTRAINT "manager_team_invitations_accountId_manager_teams_accountId_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_teams"("accountId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_team_invitations" ADD CONSTRAINT "manager_team_invitations_acceptedBy_manager_accounts_id_fk" FOREIGN KEY ("acceptedBy") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_team_member_revocations" ADD CONSTRAINT "manager_team_member_revocations_accountId_manager_teams_accountId_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_teams"("accountId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_team_member_revocations" ADD CONSTRAINT "manager_team_member_revocations_userId_manager_accounts_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_team_ownership_offers" ADD CONSTRAINT "manager_team_ownership_offers_accountId_manager_teams_accountId_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_teams"("accountId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_team_ownership_offers" ADD CONSTRAINT "manager_team_ownership_offers_ownerUserId_manager_accounts_id_fk" FOREIGN KEY ("ownerUserId") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_team_ownership_offers" ADD CONSTRAINT "manager_team_ownership_offers_recipientUserId_manager_accounts_id_fk" FOREIGN KEY ("recipientUserId") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_team_extension_policies" ADD CONSTRAINT "manager_team_extension_policies_accountId_manager_teams_accountId_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_teams"("accountId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_team_extension_policies" ADD CONSTRAINT "manager_team_policy_package_owner_fk" FOREIGN KEY ("packageId","accountId") REFERENCES "public"."manager_team_managed_packages"("id","accountId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_team_managed_packages" ADD CONSTRAINT "manager_team_managed_packages_accountId_manager_teams_accountId_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_teams"("accountId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manager_microsoft_identity_by_directory_object" ON "manager_microsoft_identity_claims" USING btree ("tenantId","objectId");--> statement-breakpoint
CREATE INDEX "manager_team_invitations_by_team" ON "manager_team_invitations" USING btree ("accountId","email");--> statement-breakpoint
CREATE INDEX "manager_team_invitations_by_microsoft_recipient" ON "manager_team_invitations" USING btree ("accountId","microsoftTenantId","microsoftObjectId");--> statement-breakpoint
CREATE INDEX "manager_team_package_cleanup" ON "manager_team_managed_packages" USING btree ("createdAt","id");--> statement-breakpoint
ALTER TABLE "manager_project_deletions" ADD CONSTRAINT "manager_project_deletions_requestedBy_manager_accounts_id_fk" FOREIGN KEY ("requestedBy") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;