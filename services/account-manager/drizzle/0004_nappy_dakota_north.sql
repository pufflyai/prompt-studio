CREATE TABLE "manager_account_features" (
	"accountId" text NOT NULL,
	"feature" text NOT NULL,
	"grantedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manager_account_features_accountId_feature_pk" PRIMARY KEY("accountId","feature")
);
--> statement-breakpoint
ALTER TABLE "manager_account_features" ADD CONSTRAINT "manager_account_features_accountId_manager_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;