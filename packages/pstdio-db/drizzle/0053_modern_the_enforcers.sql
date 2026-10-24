CREATE TABLE "storage_record_outbox" (
	"sequence" bigserial PRIMARY KEY NOT NULL,
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"frame" "bytea" NOT NULL,
	"assets" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_record_sync" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"joined" boolean DEFAULT false NOT NULL,
	"after" bigint DEFAULT 0 NOT NULL,
	"state_id" text,
	"through" bigint DEFAULT 0 NOT NULL,
	"pending_bytes" bigint DEFAULT 0 NOT NULL,
	"state_bytes" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "storage_record_sync_workbench_id_extension_id_pk" PRIMARY KEY("workbench_id","extension_id")
);
--> statement-breakpoint
ALTER TABLE "storage_record_outbox" ADD CONSTRAINT "storage_record_outbox_sync_fk" FOREIGN KEY ("workbench_id","extension_id") REFERENCES "public"."storage_record_sync"("workbench_id","extension_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_record_sync" ADD CONSTRAINT "storage_record_sync_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "storage_record_outbox_owner_idx" ON "storage_record_outbox" USING btree ("workbench_id","extension_id","sequence");