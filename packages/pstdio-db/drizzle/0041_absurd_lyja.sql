CREATE TABLE "webview_preferences" (
	"extension_id" text NOT NULL,
	"name" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"value_json" jsonb NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "webview_preferences_extension_id_name_scope_type_scope_id_pk" PRIMARY KEY("extension_id","name","scope_type","scope_id")
);
