import { existsSync } from "node:fs";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { syncRepoExtensionsForProject } from "../../extensions/repo-extensions";
import { installProjectSkillsToRepo } from "../../skills/install-skill-to-repo";
import type { AgentsRouteDeps } from "../deps";
import { agentConfigResponseSchema, setupAgentBodySchema } from "../dto";

export const setupAgentRoute = createRoute({
  method: "post",
  path: "/agents",
  description: "Add or configure an agent.",
  tags: ["Agents"],
  request: {
    query: z.object({}).strict(),
    body: {
      content: { "application/json": { schema: setupAgentBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Agent configured.",
      content: { "application/json": { schema: agentConfigResponseSchema } },
    },
  },
});

export const setupAgentHandler = (deps: AgentsRouteDeps): AppRouteHandler<typeof setupAgentRoute> => {
  return async (c) => {
    const { agent_id, binary } = c.req.valid("json");
    const createdOrExisting = await deps.agentConfigService.upsert(agent_id);
    const agent = binary
      ? ((await deps.agentConfigService.update(agent_id, { binary }))?.updated ?? createdOrExisting)
      : createdOrExisting;

    deps.eventBus.emit("agent_configs", "set", agent);

    const projects = await deps.projectService.list();
    for (const project of projects) {
      const repos = await deps.repoService.listByProject(project.id);
      for (const repo of repos) {
        await syncRepoExtensionsForProject({
          extensionService: deps.extensionService,
          installedExtensionSourcesService: deps.installedExtensionSourcesService,
          projectId: project.id,
          repoPath: repo.path,
        });
        if (!existsSync(repo.path)) continue;

        await installProjectSkillsToRepo(deps, { projectId: project.id, repoPath: repo.path });
      }
    }

    return c.json(agent, 201);
  };
};
