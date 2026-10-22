CREATE TABLE "document_snapshots" (
	"workbench_id" text NOT NULL,
	"hours" integer NOT NULL,
	"captured_at" text NOT NULL,
	"state" "bytea" NOT NULL,
	CONSTRAINT "document_snapshots_workbench_id_hours_pk" PRIMARY KEY("workbench_id","hours"),
	CONSTRAINT "document_snapshots_hours" CHECK ("document_snapshots"."hours" in (1, 12, 24))
);
--> statement-breakpoint
ALTER TABLE "document_snapshots" ADD CONSTRAINT "document_snapshots_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;