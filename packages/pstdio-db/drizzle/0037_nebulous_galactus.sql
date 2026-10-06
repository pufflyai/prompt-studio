CREATE TABLE "resource_anchors" (
	"project_id" text NOT NULL,
	"source_owner" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_id" text NOT NULL,
	"target_owner" text NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" text NOT NULL,
	"role" text DEFAULT 'context' NOT NULL,
	"details" jsonb NOT NULL,
	CONSTRAINT "resource_anchors_project_id_source_owner_source_kind_source_id_target_owner_target_kind_target_id_pk" PRIMARY KEY("project_id","source_owner","source_kind","source_id","target_owner","target_kind","target_id")
);
--> statement-breakpoint
ALTER TABLE "resource_anchors" ADD CONSTRAINT "resource_anchors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_anchors_target_idx" ON "resource_anchors" USING btree ("project_id","target_owner","target_kind","target_id","source_owner","source_kind","source_id");--> statement-breakpoint
-- Preserve only legacy anchors with a known owner. The last repeated pair wins.
INSERT INTO resource_anchors (project_id, source_owner, source_kind, source_id, target_owner, target_kind, target_id, role, details)
SELECT DISTINCT ON (project_id, source_kind, source_id, target_owner, anchor->>'type', anchor->>'id')
  project_id, 'pstdio', source_kind, source_id, target_owner, anchor->>'type', anchor->>'id',
  COALESCE(anchor->>'role', 'context'), anchor
FROM (
  SELECT source.project_id, source.source_kind, source.source_id, entries.anchor, entries.position,
    COALESCE(NULLIF(entries.anchor->>'extensionId', ''),
      CASE WHEN entries.anchor->>'type' IN ('workspace', 'session', 'project') THEN 'pstdio'
           WHEN entries.anchor->>'type' IN ('ticket', 'planner-attempt', 'planner-review') THEN 'pstdio.pstdio-planner' END) AS target_owner
  FROM (
    SELECT project_id, 'workspace' AS source_kind, id AS source_id, anchors_json FROM workspaces
    UNION ALL
    SELECT project_id, 'session', id, anchors_json FROM sessions
  ) source
  CROSS JOIN LATERAL jsonb_array_elements(source.anchors_json) WITH ORDINALITY AS entries(anchor, position)
) known
WHERE project_id IS NOT NULL AND target_owner IS NOT NULL
  AND anchor->>'type' IS NOT NULL AND anchor->>'id' IS NOT NULL
  AND (anchor->>'projectId' IS NULL OR anchor->>'projectId' = project_id)
ORDER BY project_id, source_kind, source_id, target_owner, anchor->>'type', anchor->>'id', position DESC;
--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "anchors_json";--> statement-breakpoint
ALTER TABLE "workspaces" DROP COLUMN "anchors_json";