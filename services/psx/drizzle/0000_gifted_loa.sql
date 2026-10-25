CREATE TABLE "extension_releases" (
	"extension_id" text NOT NULL,
	"version" text NOT NULL,
	"engines_pstdio" text NOT NULL,
	"sha256" text NOT NULL,
	"withdrawn" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extension_releases_extension_id_version_pk" PRIMARY KEY("extension_id","version")
);
