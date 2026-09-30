CREATE TABLE "board_default_views" (
	"project_id" text NOT NULL,
	"extension_instance_id" text NOT NULL,
	"board_id" text NOT NULL,
	"default_view_id" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "board_default_views_project_id_extension_instance_id_board_id_pk" PRIMARY KEY("project_id","extension_instance_id","board_id")
);
--> statement-breakpoint
CREATE TABLE "board_views" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"extension_instance_id" text NOT NULL,
	"board_id" text NOT NULL,
	"title" text NOT NULL,
	"settings" jsonb NOT NULL,
	"filters" jsonb NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_default_views" ADD CONSTRAINT "board_default_views_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_default_views" ADD CONSTRAINT "board_default_views_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_views" ADD CONSTRAINT "board_views_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_views" ADD CONSTRAINT "board_views_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_views_scope_order_idx" ON "board_views" USING btree ("project_id","extension_instance_id","board_id","sort_order");