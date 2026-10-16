CREATE TABLE "relay_asset_parts" (
	"ownerId" text NOT NULL,
	"uploadId" text NOT NULL,
	"number" integer NOT NULL,
	"sha256" text NOT NULL,
	"byteLength" bigint NOT NULL,
	"etag" text,
	CONSTRAINT "relay_asset_parts_ownerId_uploadId_number_pk" PRIMARY KEY("ownerId","uploadId","number")
);
--> statement-breakpoint
CREATE TABLE "relay_asset_uploads" (
	"ownerId" text NOT NULL,
	"id" text NOT NULL,
	"asset" jsonb NOT NULL,
	"objectKey" text NOT NULL,
	"partSize" bigint NOT NULL,
	"multipartId" text,
	"status" text NOT NULL,
	CONSTRAINT "relay_asset_uploads_ownerId_id_pk" PRIMARY KEY("ownerId","id")
);
--> statement-breakpoint
CREATE TABLE "relay_verified_assets" (
	"ownerId" text NOT NULL,
	"reference" text NOT NULL,
	"asset" jsonb NOT NULL,
	"objectKey" text NOT NULL,
	"etag" text NOT NULL,
	CONSTRAINT "relay_verified_assets_ownerId_reference_pk" PRIMARY KEY("ownerId","reference")
);
