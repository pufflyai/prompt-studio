CREATE TABLE "manager_microsoft_identity_claims" (
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"tenantId" text NOT NULL,
	"objectId" text NOT NULL,
	CONSTRAINT "manager_microsoft_identity_claims_issuer_subject_pk" PRIMARY KEY("issuer","subject")
);
--> statement-breakpoint
ALTER TABLE "manager_team_invitations" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "manager_team_invitations" ADD COLUMN "microsoftTenantId" text;--> statement-breakpoint
ALTER TABLE "manager_team_invitations" ADD COLUMN "microsoftObjectId" text;--> statement-breakpoint
CREATE INDEX "manager_microsoft_identity_by_directory_object" ON "manager_microsoft_identity_claims" USING btree ("tenantId","objectId");--> statement-breakpoint
CREATE INDEX "manager_team_invitations_by_microsoft_recipient" ON "manager_team_invitations" USING btree ("accountId","microsoftTenantId","microsoftObjectId");--> statement-breakpoint
ALTER TABLE "manager_team_invitations" ADD CONSTRAINT "manager_team_invitation_recipient" CHECK (("manager_team_invitations"."email" is not null and "manager_team_invitations"."microsoftTenantId" is null and "manager_team_invitations"."microsoftObjectId" is null)
        or ("manager_team_invitations"."email" is null and "manager_team_invitations"."microsoftTenantId" is not null and "manager_team_invitations"."microsoftObjectId" is not null));