CREATE TABLE "extension_release_bundles" (
	"extension_id" text NOT NULL,
	"version" text NOT NULL,
	"host" text NOT NULL,
	"sha256" text NOT NULL,
	"size_bytes" integer NOT NULL,
	CONSTRAINT "extension_release_bundles_extension_id_version_host_pk" PRIMARY KEY("extension_id","version","host")
);
--> statement-breakpoint
ALTER TABLE "extension_release_bundles" ADD CONSTRAINT "extension_release_bundles_extension_id_version_extension_releases_extension_id_version_fk" FOREIGN KEY ("extension_id","version") REFERENCES "public"."extension_releases"("extension_id","version") ON DELETE cascade ON UPDATE no action;