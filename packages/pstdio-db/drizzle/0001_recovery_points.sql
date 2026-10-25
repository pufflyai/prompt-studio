CREATE TABLE "recovery_point_owners" (
	"workbench_id" text NOT NULL,
	"hours" integer NOT NULL,
	"extension_id" text NOT NULL,
	"revision" bigint NOT NULL,
	"records" "bytea" NOT NULL,
	"metadata" "bytea" NOT NULL,
	CONSTRAINT "recovery_point_owners_workbench_id_hours_extension_id_pk" PRIMARY KEY("workbench_id","hours","extension_id")
);
--> statement-breakpoint
CREATE TABLE "recovery_points" (
	"workbench_id" text NOT NULL,
	"hours" integer NOT NULL,
	"captured_at" text NOT NULL,
	CONSTRAINT "recovery_points_workbench_id_hours_pk" PRIMARY KEY("workbench_id","hours"),
	CONSTRAINT "recovery_points_hours" CHECK ("recovery_points"."hours" in (1, 12, 24))
);
--> statement-breakpoint
ALTER TABLE "recovery_point_owners" ADD CONSTRAINT "recovery_point_owners_workbench_id_hours_recovery_points_workbench_id_hours_fk" FOREIGN KEY ("workbench_id","hours") REFERENCES "public"."recovery_points"("workbench_id","hours") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_points" ADD CONSTRAINT "recovery_points_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;