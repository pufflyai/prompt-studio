import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
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
      settings: {
        viewMode: "list",
        rowGrouping: "none",
        columnGrouping: "status",
        displayProperties: ["id", "status"],
      },
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
  assert(view.ok, `Saving filtered view failed: HTTP ${view.status}`);
  const { id } = (await view.json()) as { id: string };
  assert(id, "Saved view identity missing");
  const selected = await fetch(`${boardUrl}/views/default`, {
    method: "PUT",
    headers: runtime.headers,
    body: JSON.stringify({ viewId: id }),
  });
  assert(selected.ok, `Selecting filtered view failed: HTTP ${selected.status}`);
};

const installPlanner = async (
  runtime: Awaited<ReturnType<typeof startRuntime>>,
  home: string,
  plannerSource?: string,
) => {
  const source = await preparePlannerSource(join(home, "fixtures"), { sourcePath: plannerSource });
  const env = { ...process.env, HOME: home, PSTDIO_HOME: home };
  const added = await promisify(execFile)(
    PACKAGED_BINARY_PATH,
    ["extensions", "add", source, "--name", "pstdio-planner", "--force"],
    {
      cwd: join(home, "project"),
      env: { ...env, PSTDIO_API_URL: runtime.baseUrl, PSTDIO_API_TOKEN: runtime.descriptor.token },
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  process.stderr.write(added.stderr);
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
    // Keep draining the already-running host's output while setup issues commands.
    // A synchronous child blocks those listeners and can fill the native pipe.
    const seeded = await promisify(execFile)(
      "bun",
      [join(repoRoot, "scripts/dev/seed-planner-stress.ts"), connection],
      {
        env: { ...process.env, PSTDIO_PLANNER_STRESS_TICKETS: "1000" },
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    process.stderr.write(seeded.stderr);
    const fixture = JSON.parse(seeded.stdout.trim()) as Fixture;
    await saveFilteredView(runtime, fixture.projectId);
    const tickets: { id: string; title: string; content: string }[] = [];
    let cursor: string | undefined;
    do {
      const page = await runtime.execute<{ tickets: typeof tickets; cursor: string | null }>(
        fixture.projectId,
        "read-tickets",
        { limit: 100, cursor },
      );
      tickets.push(...page.tickets);
      cursor = page.cursor ?? undefined;
    } while (cursor);
    assert.equal(tickets.length, fixture.tickets, "Every frozen ticket must receive its complete edit history");
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
