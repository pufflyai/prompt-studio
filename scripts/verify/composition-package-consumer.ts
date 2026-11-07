import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const writeCompositionPackageConsumer = (directory: string) => {
  writeFileSync(
    join(directory, "composition-consumer.ts"),
    `
import { createClient } from "@pstdio/sdk/client";
import type { ProjectComposition } from "@pstdio/sdk/api";
import { defineCommand, workbenchCommands } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";

const page = { kind: "page" as const, extensionId: "example.reader", id: "desk" };
let saved: ProjectComposition = { defaultPage: null, resourceOpeners: [] };
const methods: string[] = [];
const client = createClient({ baseUrl: "https://composition.test", fetch: async (input, init) => {
  const request = new Request(input, init);
  const path = new URL(request.url).pathname;
  methods.push(request.method);
  if (path === "/v1/projects/project/composition") {
    if (request.method === "PUT") saved = await request.json() as ProjectComposition;
    return Response.json(saved);
  }
  if (path !== "/v1/projects/project/resource-openings") throw new Error("Unexpected public endpoint");
  const body = await request.json() as { resources: { type: string; id: string }[] };
  return Response.json(body.resources.map(resource => ({ resource, target: { kind: "page", page, resource } })));
} });
const choice: ProjectComposition = {
  defaultPage: page,
  resourceOpeners: [{ resourceKind: { kind: "resource-kind", extensionId: "pstdio", id: "workspace" }, opener: page }],
};
await client.projects.setComposition("project", choice);
if ((await client.projects.composition("project")).defaultPage?.id !== "desk") throw new Error("Composition did not round-trip");
const command = defineCommand({ id: "open", title: "Open resource", async run(ctx) {
  return ctx.resources.resolveOpenings([{ type: "workspace", id: "workspace", extensionId: "pstdio", projectId: "project" }]);
} });
const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {}, overrides: {
  resources: { resolveOpenings: resources => client.projects.resolveResourceOpenings("project", resources) },
} });
const [opening] = await command.run(ctx, {});
if (opening?.target?.kind !== "page" || opening.target.page.extensionId !== "example.reader") throw new Error("Public resource opener is unavailable");
if (methods.join(",") !== "PUT,GET,POST") throw new Error("Unexpected SDK request methods");
void workbenchCommands.openDefaultPage;
`,
  );
};
