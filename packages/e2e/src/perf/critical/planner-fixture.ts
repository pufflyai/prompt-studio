import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { folderProjectInput } from "../../helpers/folder-project";
import { PACKAGED_BINARY_PATH } from "../../packaged/packaged-helpers";
import { preparePlannerSource } from "../../packaged/packaged-planner-source";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "../../packaged/packaged-serve-helpers";
import { prepareMemoryExtensions } from "../desktop-memory-app";

const repoRoot = join(import.meta.dirname, "../../../../..");
const board = "pstdio.pstdio-planner.view.tickets";
interface Fixture {
  projectId: string;
  tickets: number;
}

export const startRuntime = async (home: string, defaultSources: { installName: string; source: string }[]) => {
  const started = await startPackagedServe(home, {
    PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({ defaultExtensions: defaultSources }),
    PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1",
    PSTDIO_BENCHMARK_COUNTERS: "1",
  });
  const headers = { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" };
  const execute = async <T>(projectId: string, command: string, params: Record<string, unknown>) => {
    const response = await fetch(
      `${started.baseUrl}/v1/projects/${projectId}/extensions/commands/pstdio.pstdio-planner.command.${command}/execute`,
      { method: "POST", headers, body: JSON.stringify({ params }) },
    );
    const body = (await response.json()) as { outcome: { status: string; value: T } };
    if (body.outcome.status !== "success") throw new Error(`${command}: ${JSON.stringify(body)}`);
    return body.outcome.value;
  };
  return { ...started, headers, execute };
};

const saveFilteredView = async (runtime: Awaited<ReturnType<typeof startRuntime>>, projectId: string) => {
  const boardUrl = `${runtime.baseUrl}/v1/projects/${projectId}/boards/${board}`;
  const view = await fetch(`${boardUrl}/views`, {
    method: "POST",
    headers: runtime.headers,
    body: JSON.stringify({
      title: "In flight",
      settings: { viewMode: "list", rowGrouping: "none", columnGrouping: "status", displayProperties: ["id"] },
      filter: {
        conjunction: "and",
        rules: [
          { attributeId: "archived", condition: "is-any-of", value: ["active"] },
          { attributeId: "status", condition: "is-any-of", value: ["ready", "in-progress"] },
          { attributeId: "priority", condition: "is-none-of", value: ["default-priority-low"] },
        ],
      },
      sorts: [{ attributeId: "created", direction: "desc" }],
    }),
  });
  const { id } = (await view.json()) as { id: string };
  await fetch(`${boardUrl}/views/default`, {
    method: "PUT",
    headers: runtime.headers,
    body: JSON.stringify({ viewId: id }),
  });
};

const installPlanner = async (
  runtime: Awaited<ReturnType<typeof startRuntime>>,
  home: string,
  plannerSource?: string,
) => {
  const source = await preparePlannerSource(join(home, "fixtures"), { sourcePath: plannerSource });
  const env = { ...process.env, HOME: home, PSTDIO_HOME: home };
  const added = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "add", source, "--name", "pstdio-planner", "--force"], {
    cwd: join(home, "project"),
    env: { ...env, PSTDIO_API_URL: runtime.baseUrl, PSTDIO_API_TOKEN: runtime.descriptor.token },
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (added.status !== 0) throw new Error("Installing Planner failed.");
};

const editedContent = (title: string, edit: number) =>
  `# ${title}\n\n${"Revised plan details. ".repeat(60)}\n\nEdit ${edit}`;

// Seeds the tickets, a saved filtered view, and edit history before restarting the runtime.
export const seedHome = async (home: string) => {
  const profile = await prepareMemoryExtensions(join(home, "public-extensions"), new AbortController().signal, false);
  const defaultSources = profile.sources;
  const runtime = await startRuntime(home, defaultSources);
  try {
    const folder = join(home, "project");
    mkdirSync(folder, { recursive: true });
    const projects = await fetch(`${runtime.baseUrl}/v1/projects`, { headers: runtime.headers });
    if (!projects.ok) throw new Error(`Reading projects failed: HTTP ${projects.status}`);
    const existing = ((await projects.json()) as { name: string }[]).some((project) => project.name === "project");
    if (!existing) {
      const created = await fetch(`${runtime.baseUrl}/v1/projects`, {
        method: "POST",
        headers: runtime.headers,
        body: JSON.stringify(folderProjectInput({ name: "project" }, folder)),
      });
      if (!created.ok) throw new Error(`Creating the project failed: HTTP ${created.status}`);
      const value = await created.json();
      if (value.extension_warnings?.length)
        throw new Error(`Default tools failed: ${JSON.stringify(value.extension_warnings)}`);
    }
    await installPlanner(runtime, home);
    const connection = join(home, "connection.json");
    const port = Number(new URL(runtime.baseUrl).port);
    writeFileSync(
      connection,
      JSON.stringify({ apiPort: port, apiToken: runtime.descriptor.token, dashboardUrl: runtime.baseUrl }),
    );
    const seeded = spawnSync("bun", [join(repoRoot, "scripts/dev/seed-planner-stress.ts"), connection], {
      env: { ...process.env, PSTDIO_PLANNER_STRESS_TICKETS: "1000" },
      stdio: ["ignore", "pipe", "inherit"],
      encoding: "utf8",
    });
    if (seeded.status !== 0) throw new Error("Seeding tickets failed.");
    const fixture = JSON.parse(seeded.stdout.trim()) as Fixture;
    await saveFilteredView(runtime, fixture.projectId);
    const tickets = await runtime.execute<{ id: string; title: string; content: string }[]>(
      fixture.projectId,
      "read-tickets",
      {},
    );
    for (const [index, ticket] of tickets.entries()) {
      const completed =
        Array.from({ length: 3 }, (_, index) => index + 1).findLast(
          (edit) => ticket.content === editedContent(ticket.title, edit),
        ) ?? 0;
      for (let edit = completed + 1; edit <= 3; edit++)
        await runtime.execute(fixture.projectId, "update-ticket", {
          id: ticket.id,
          content: editedContent(ticket.title, edit),
        });
      if (index % 100 === 99) process.stderr.write(`Edited ${index + 1}/${tickets.length} tickets\n`);
    }
    writeFileSync(join(home, "fixture.json"), JSON.stringify(fixture));
    return { ...fixture, defaultSources };
  } finally {
    await stopProcess(runtime.child);
  }
};
