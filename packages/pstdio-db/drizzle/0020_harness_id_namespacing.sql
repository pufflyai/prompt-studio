-- Custom migration: rewrite bare agent ids to namespaced extension harness ids.
-- Only exact bare ids are rewritten, so re-running is a no-op.
UPDATE "agent_configs" SET "agent_id" = 'pstdio.harness-claude-code.claude-code' WHERE "agent_id" = 'claude-code';--> statement-breakpoint
UPDATE "agent_configs" SET "agent_id" = 'pstdio.harness-open-code.opencode' WHERE "agent_id" = 'opencode';--> statement-breakpoint
UPDATE "agent_configs" SET "agent_id" = 'pstdio.harness-lab.fake' WHERE "agent_id" = 'fake';--> statement-breakpoint
UPDATE "projects" SET "default_agent_id" = 'pstdio.harness-claude-code.claude-code' WHERE "default_agent_id" = 'claude-code';--> statement-breakpoint
UPDATE "projects" SET "default_agent_id" = 'pstdio.harness-open-code.opencode' WHERE "default_agent_id" = 'opencode';--> statement-breakpoint
UPDATE "projects" SET "default_agent_id" = 'pstdio.harness-lab.fake' WHERE "default_agent_id" = 'fake';--> statement-breakpoint
UPDATE "projects" SET "selected_agents" = replace("selected_agents", '"claude-code"', '"pstdio.harness-claude-code.claude-code"') WHERE "selected_agents" LIKE '%"claude-code"%';--> statement-breakpoint
UPDATE "projects" SET "selected_agents" = replace("selected_agents", '"opencode"', '"pstdio.harness-open-code.opencode"') WHERE "selected_agents" LIKE '%"opencode"%';--> statement-breakpoint
UPDATE "projects" SET "selected_agents" = replace("selected_agents", '"fake"', '"pstdio.harness-lab.fake"') WHERE "selected_agents" LIKE '%"fake"%';--> statement-breakpoint
UPDATE "sessions" SET "agent" = 'pstdio.harness-claude-code.claude-code' WHERE "agent" = 'claude-code';--> statement-breakpoint
UPDATE "sessions" SET "agent" = 'pstdio.harness-open-code.opencode' WHERE "agent" = 'opencode';--> statement-breakpoint
UPDATE "sessions" SET "agent" = 'pstdio.harness-lab.fake' WHERE "agent" = 'fake';
