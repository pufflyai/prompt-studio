CREATE TABLE "manager_space_keys" (
	"accountId" text NOT NULL,
	"workbenchId" text NOT NULL,
	"space" text NOT NULL,
	"generation" integer NOT NULL,
	"secret" text NOT NULL,
	CONSTRAINT "manager_space_keys_accountId_workbenchId_space_generation_pk" PRIMARY KEY("accountId","workbenchId","space","generation")
);
--> statement-breakpoint
ALTER TABLE "manager_space_keys" ADD CONSTRAINT "manager_space_keys_accountId_manager_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;