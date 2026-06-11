DROP TABLE "agent_configs" CASCADE;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "selected_agents";--> statement-breakpoint
UPDATE "projects" SET "default_agent_id" = 'pstdio.harness-claude-code.claude-code' WHERE "default_agent_id" = 'claude-code';--> statement-breakpoint
UPDATE "projects" SET "default_agent_id" = 'pstdio.harness-open-code.opencode' WHERE "default_agent_id" = 'opencode';--> statement-breakpoint
UPDATE "projects" SET "default_agent_id" = 'pstdio.harness-lab.fake' WHERE "default_agent_id" = 'fake';--> statement-breakpoint
UPDATE "sessions" SET "agent" = 'pstdio.harness-claude-code.claude-code' WHERE "agent" = 'claude-code';--> statement-breakpoint
UPDATE "sessions" SET "agent" = 'pstdio.harness-open-code.opencode' WHERE "agent" = 'opencode';--> statement-breakpoint
UPDATE "sessions" SET "agent" = 'pstdio.harness-lab.fake' WHERE "agent" = 'fake';
