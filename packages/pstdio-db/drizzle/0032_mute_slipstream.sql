DROP TABLE "project_repos" CASCADE;--> statement-breakpoint
DROP TABLE "repos" CASCADE;--> statement-breakpoint
ALTER TABLE "workspaces" RENAME COLUMN "worktree_path" TO "root_path";