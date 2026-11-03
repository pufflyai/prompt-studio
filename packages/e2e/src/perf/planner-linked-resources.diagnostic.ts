import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildBinary, PACKAGED_BINARY_PATH } from "../packaged/packaged-helpers";
import { preparePlannerSource } from "../packaged/packaged-planner-source";
import {
  installLinkedResourceFixture,
  linkedResourcesApi,
  seedLinkedResources,
} from "./planner-linked-resources-fixture";

// Leaves the workload visible in the disposable Docker app for manual inspection.
const repo = resolve(import.meta.dir, "../../../..");
const connection = JSON.parse(
  readFileSync(join(repo, "__test-tmp__/dev-isolated/pstdio-playwright/connection.json"), "utf8"),
);
const apiUrl = `http://127.0.0.1:${connection.apiPort}`;
const api = linkedResourcesApi(apiUrl, connection.apiToken);
const projects = await api.request<{ id: string; name: string }[]>("/projects");
const project = projects.find((project) => project.name === "project");
assert(project, "Start a fresh dev:playwright stack first");
const tickets = await api.execute<unknown[]>(project.id, "pstdio.pstdio-planner", "read-tickets");
assert.equal(tickets.length, 0, "Use a fresh dev:playwright stack");
buildBinary();
const root = join(repo, "__test-tmp__/planner-linked-resources-demo", String(Date.now()));
const cliProject = join(root, "cli-project");
mkdirSync(join(cliProject, ".pstdio"), { recursive: true });
writeFileSync(join(cliProject, ".pstdio/config.json"), JSON.stringify({ project_id: project.id }));
const install = (source: string, name: string) => {
  execFileSync(PACKAGED_BINARY_PATH, ["extensions", "add", source, "--name", name, "--force"], {
    cwd: cliProject,
    env: { ...process.env, PSTDIO_API_URL: apiUrl, PSTDIO_API_TOKEN: connection.apiToken },
    stdio: "inherit",
  });
};
install(await preparePlannerSource(join(root, "planner")), "pstdio-planner");
await installLinkedResourceFixture(api, project.id, root, install);
const fixture = await seedLinkedResources(api, project.id);
writeFileSync(join(root, "linked-fixture.json"), JSON.stringify(fixture));
console.info(`Board: ${connection.dashboardUrl}projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
console.info("Stop and remove the demo with bun run dev:playwright:down after inspection.");
