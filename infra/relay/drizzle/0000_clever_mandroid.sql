CREATE TABLE "relay_conflicts" (
	"ownerId" text NOT NULL,
	"id" text NOT NULL,
	"revision" bigint NOT NULL,
	"recordIds" text[] NOT NULL,
	"alternativeOperationIds" text[] NOT NULL,
	"resolvedBy" text,
	CONSTRAINT "relay_conflicts_ownerId_id_pk" PRIMARY KEY("ownerId","id")
);
--> statement-breakpoint
CREATE TABLE "relay_operations" (
	"ownerId" text NOT NULL,
	"id" text NOT NULL,
	"mutation" jsonb NOT NULL,
	"order" bigint NOT NULL,
	"status" text NOT NULL,
	"checkpointEpoch" text,
	"acceptedSequence" bigint,
	"conflictId" text,
	"reason" text,
	CONSTRAINT "relay_operations_ownerId_id_pk" PRIMARY KEY("ownerId","id")
);
--> statement-breakpoint
CREATE TABLE "relay_records" (
	"ownerId" text NOT NULL,
	"id" text NOT NULL,
	"record" jsonb NOT NULL,
	CONSTRAINT "relay_records_ownerId_id_pk" PRIMARY KEY("ownerId","id")
);
--> statement-breakpoint
CREATE TABLE "relay_scopes" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" jsonb NOT NULL,
	"epoch" text NOT NULL,
	"acceptedSequence" bigint NOT NULL,
	"journalSequence" bigint NOT NULL,
	"replayFrom" bigint NOT NULL,
	"publishedRevision" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "relay_conflicts" ADD CONSTRAINT "relay_conflicts_ownerId_relay_scopes_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."relay_scopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relay_operations" ADD CONSTRAINT "relay_operations_ownerId_relay_scopes_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."relay_scopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relay_records" ADD CONSTRAINT "relay_records_ownerId_relay_scopes_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."relay_scopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "relay_conflicts_records" ON "relay_conflicts" USING gin ("recordIds");--> statement-breakpoint
CREATE UNIQUE INDEX "relay_operations_order" ON "relay_operations" USING btree ("ownerId","order");--> statement-breakpoint
CREATE UNIQUE INDEX "relay_operations_accepted_sequence" ON "relay_operations" USING btree ("ownerId","acceptedSequence");--> statement-breakpoint
CREATE INDEX "relay_operations_captures" ON "relay_operations" USING gin (("mutation"->'resolution'->'capturedOperationIds')) WHERE "relay_operations"."status" = 'accepted';