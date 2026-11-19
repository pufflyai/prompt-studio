CREATE TABLE "manager_project_deletions" (
	"accountId" text NOT NULL,
	"workbenchId" text NOT NULL,
	"operationId" text NOT NULL,
	"delivery" integer DEFAULT 1 NOT NULL,
	"startedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"state" text NOT NULL,
	"completedAt" timestamp with time zone,
	CONSTRAINT "manager_project_deletions_accountId_workbenchId_pk" PRIMARY KEY("accountId","workbenchId")
);
--> statement-breakpoint
ALTER TABLE "manager_project_deletions" ADD CONSTRAINT "manager_project_deletions_accountId_manager_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."manager_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manager_project_deletions_pending" ON "manager_project_deletions" USING btree ("startedAt","operationId") WHERE "manager_project_deletions"."state" = 'deleting';