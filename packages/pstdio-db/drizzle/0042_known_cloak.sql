CREATE TABLE "local_environment" (
	"id" text PRIMARY KEY NOT NULL,
	"environment_id" text NOT NULL,
	CONSTRAINT "local_environment_single_owner" CHECK ("local_environment"."id" = 'local')
);
