CREATE TABLE "relay_sync_blobs" (
	"projectKey" text NOT NULL,
	"blobId" text NOT NULL,
	"spaceOwner" text,
	"sha256" text NOT NULL,
	"byteLength" bigint NOT NULL,
	"status" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"completedAt" timestamp with time zone,
	"lastUsedAt" timestamp with time zone,
	CONSTRAINT "relay_sync_blobs_projectKey_blobId_pk" PRIMARY KEY("projectKey","blobId")
);
--> statement-breakpoint
CREATE TABLE "relay_sync_documents" (
	"projectKey" text NOT NULL,
	"documentId" text NOT NULL,
	"spaceOwner" text,
	"lastSequence" bigint NOT NULL,
	"stateId" text,
	CONSTRAINT "relay_sync_documents_projectKey_documentId_pk" PRIMARY KEY("projectKey","documentId")
);
--> statement-breakpoint
CREATE TABLE "relay_sync_object_deletions" (
	"objectKey" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relay_sync_projects" (
	"projectKey" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relay_sync_states" (
	"projectKey" text NOT NULL,
	"documentId" text NOT NULL,
	"stateId" text NOT NULL,
	"baseStateId" text,
	"through" bigint NOT NULL,
	"byteLength" bigint NOT NULL,
	"summary" text NOT NULL,
	"objectKey" text NOT NULL,
	"blobIds" text[] NOT NULL,
	"deviceId" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"replacedAt" timestamp with time zone,
	CONSTRAINT "relay_sync_states_projectKey_documentId_stateId_pk" PRIMARY KEY("projectKey","documentId","stateId")
);
--> statement-breakpoint
CREATE TABLE "relay_sync_updates" (
	"projectKey" text NOT NULL,
	"documentId" text NOT NULL,
	"sequence" bigint NOT NULL,
	"updateId" text NOT NULL,
	"deviceId" text NOT NULL,
	"byteLength" bigint NOT NULL,
	"objectKey" text NOT NULL,
	"blobIds" text[] NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"coveredAt" timestamp with time zone,
	CONSTRAINT "relay_sync_updates_projectKey_documentId_sequence_pk" PRIMARY KEY("projectKey","documentId","sequence")
);
--> statement-breakpoint
ALTER TABLE "relay_sync_blobs" ADD CONSTRAINT "relay_sync_blobs_projectKey_relay_sync_projects_projectKey_fk" FOREIGN KEY ("projectKey") REFERENCES "public"."relay_sync_projects"("projectKey") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relay_sync_documents" ADD CONSTRAINT "relay_sync_documents_projectKey_relay_sync_projects_projectKey_fk" FOREIGN KEY ("projectKey") REFERENCES "public"."relay_sync_projects"("projectKey") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "relay_sync_projects_account" ON "relay_sync_projects" USING btree ("accountId");--> statement-breakpoint
CREATE UNIQUE INDEX "relay_sync_states_object" ON "relay_sync_states" USING btree ("objectKey");--> statement-breakpoint
CREATE INDEX "relay_sync_states_replaced" ON "relay_sync_states" USING btree ("replacedAt");--> statement-breakpoint
CREATE INDEX "relay_sync_states_blobs" ON "relay_sync_states" USING gin ("blobIds");--> statement-breakpoint
CREATE UNIQUE INDEX "relay_sync_updates_identity" ON "relay_sync_updates" USING btree ("projectKey","documentId","updateId");--> statement-breakpoint
CREATE UNIQUE INDEX "relay_sync_updates_object" ON "relay_sync_updates" USING btree ("objectKey");--> statement-breakpoint
CREATE INDEX "relay_sync_updates_covered" ON "relay_sync_updates" USING btree ("coveredAt");--> statement-breakpoint
CREATE INDEX "relay_sync_updates_blobs" ON "relay_sync_updates" USING gin ("blobIds");