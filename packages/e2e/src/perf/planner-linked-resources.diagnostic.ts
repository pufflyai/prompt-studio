import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const connectionPath = join(repo, "__test-tmp__/dev-isolated/pstdio-playwright/connection.json");
assert(!existsSync(connectionPath), "Stop the previous demo with bun run dev:playwright:down first");
execFileSync(
  "bun",
  ["run", "build", "--", "--scope", "pstdio-dashboard", "--scope", "pstdio-api", "--include-dependencies"],
  {
    cwd: repo,
    stdio: "inherit",
  },
);
buildBinary();
const root = join(repo, "__test-tmp__/planner-linked-resources-demo", String(Date.now()));
const planner = await preparePlannerSource(join(root, "planner"));
// Planner needs the candidate SDK before runtime setup validates its contributions.
execFileSync("bun", ["run", "dev:playwright", "--", "--desktop"], {
  cwd: repo,
  env: {
    ...process.env,
    PSTDIO_ISOLATED_AGENT_CREDENTIALS: "0",
    PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
      defaultExtensions: [
        { source: join(repo, "extensions/harness-codex"), installName: "harness-codex" },
        { source: planner, installName: "pstdio-planner" },
      ],
    }),
  },
  stdio: "inherit",
});
const connection = JSON.parse(readFileSync(connectionPath, "utf8"));
const apiUrl = `http://127.0.0.1:${connection.apiPort}`;
const api = linkedResourcesApi(apiUrl, connection.apiToken);
const projects = await api.request<{ id: string; name: string }[]>("/projects");
const project = projects.find((project) => project.name === "project");
assert(project, "Start a fresh dev:playwright stack first");
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
await installLinkedResourceFixture(api, project.id, root, install);
const fixture = await seedLinkedResources(api, project.id);
writeFileSync(join(root, "linked-fixture.json"), JSON.stringify(fixture));
const login = await fetch(`${apiUrl}/runtime/browser-login`, {
  method: "POST",
  headers: { authorization: `Bearer ${connection.apiToken}` },
});
assert(login.ok, `Browser login failed: ${login.status}`);
const board = new URL(((await login.json()) as { url: string }).url);
board.pathname = `/projects/${project.id}/extensions/pstdio.planner/tickets`;
console.info(`Board: ${board.href}`);
console.info("Stop and remove the demo with bun run dev:playwright:down after inspection.");
