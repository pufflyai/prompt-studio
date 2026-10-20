import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { EXTENSION_API_VERSION } from "@pstdio/sdk/extensions";
import { buildBinary, PACKAGED_BINARY_PATH } from "../packaged/packaged-helpers";
import { preparePlannerSource } from "../packaged/packaged-planner-source";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "../packaged/packaged-serve-helpers";

export const SUBNAV_WORKLOAD = { files: 15_000, tickets: 1_000, sessions: 1_000, linkedWorkspaces: 5 };
const repoRoot = resolve(import.meta.dirname, "../../../..");
export const subnavFixtureRoot = join(repoRoot, "work/subnav-benchmark");

const buildBenchmarkBinary = () => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) {
    // The host compiler embeds existing dashboard assets; refresh them before compiling.
    execFileSync(
      "bun",
      [
        "run",
        "build",
        "--",
        "--scope",
        "pstdio-dashboard",
        "--scope",
        "pstdio-api",
        "--include-dependencies",
        "--stream",
      ],
      { cwd: repoRoot, stdio: "inherit" },
    );
  }
  buildBinary();
};

interface FixtureTicket {
  id: string;
  shorthand: string;
  title: string;
}
const seedTickets = async (execute: (command: string, params?: Record<string, unknown>) => Promise<unknown>) => {
  const tickets = (await execute("read-tickets")) as FixtureTicket[];
  while (tickets.length < SUBNAV_WORKLOAD.tickets) {
    const index = tickets.length;
    tickets.push(
      (await execute("create-ticket", {
        content: `# Benchmark ticket ${String(index + 1).padStart(4, "0")}\n\n${"Representative ticket instructions.\n".repeat(128)}`,
      })) as FixtureTicket,
    );
    if (tickets.length % 100 === 0) console.info(`Tickets ${tickets.length}/${SUBNAV_WORKLOAD.tickets}`);
  }
  return tickets;
};

const seedFiles = async (folder: string) => {
  if (existsSync(join(folder, ".git"))) return;
  mkdirSync(folder, { recursive: true });
  const git = (args: string[]) => execFileSync("git", ["-C", folder, ...args], { stdio: "pipe" });
  git(["init", "-b", "main"]);
  git(["config", "user.email", "benchmark@example.com"]);
  git(["config", "user.name", "Subnav benchmark"]);
  writeFileSync(join(folder, ".gitignore"), ".pstdio/\n.agents/\n.claude/\n.opencode/\n");
  for (let directory = 0; directory < 100; directory++) {
    const path = join(folder, `src${directory}`);
    await mkdir(path, { recursive: true });
    await Promise.all(
      Array.from({ length: 150 }, (_, index) =>
        writeFile(join(path, `file${index}.ts`), `export const value = '${directory}-${index}';\n`.repeat(128)),
      ),
    );
  }
  git(["add", "."]);
  git(["commit", "-qm", "Navigation benchmark workload"]);
};

export const startSubnavBenchmarkFixture = async () => {
  buildBenchmarkBinary();
  const root = subnavFixtureRoot;
  mkdirSync(root, { recursive: true });
  const folder = join(root, "project");
  await seedFiles(folder);
  const files = execFileSync("git", ["-C", folder, "ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter((path) => path.endsWith(".ts"));
  if (files.length !== SUBNAV_WORKLOAD.files)
    throw new Error("Fixture source file count does not match the fixed workload");
  const fixtureSource = join(root, "fixture-source");
  mkdirSync(fixtureSource, { recursive: true });
  writeFileSync(
    join(fixtureSource, "package.json"),
    JSON.stringify({
      name: "subnav-fixture",
      publisher: "test",
      version: "1.0.0",
      type: "module",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(fixtureSource, "extension.ts"),
    `export default { harnesses: [{ id: "worker", ref: {kind:"harness", id:"worker"}, label: "Benchmark worker", capabilities: () => [], listModels: () => [], start: () => ({done: Promise.resolve({status:"completed"}),stop(){}}), resume: () => ({done: Promise.resolve({status:"completed"}),stop(){}}) }] };`,
  );
  const cache = process.env.BUN_INSTALL_CACHE_DIR ?? execFileSync("bun", ["pm", "cache"], { encoding: "utf8" }).trim();
  const started = await startPackagedServe(root, {
    PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source: fixtureSource, installName: "subnav-fixture" }]),
    PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1",
    BUN_INSTALL_CACHE_DIR: cache,
  });
  // Drain logs throughout the run so a full pipe cannot stall the runtime.
  const log = Bun.file(join(root, "runtime.log")).writer();
  started.child.stdout?.on("data", (chunk) => log.write(chunk));
  started.child.stderr?.on("data", (chunk) => log.write(chunk));
  const stop = async () => {
    await stopProcess(started.child);
    await log.end();
  };
  const headers = { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" };
  const request = async (path: string, body?: unknown, method = body === undefined ? "GET" : "POST") => {
    const response = await fetch(`${started.baseUrl}/v1${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${path}: ${response.status} ${text}`);
    return JSON.parse(text);
  };
  try {
    let project = (await request("/projects")).find((row: { name: string }) => row.name === "Subnav benchmark");
    project ??= await request("/projects", {
      name: "Subnav benchmark",
      initial_workspace: { provider_id: "pstdio.root", params: { path: folder } },
    });
    const source =
      process.env.SUBNAV_PLANNER_SOURCE ??
      (await preparePlannerSource(root, {
        offline: process.env.SUBNAV_OFFLINE === "1",
      }));
    {
      console.info("Installing the real Planner extension");
      const installing = Bun.spawn(
        [PACKAGED_BINARY_PATH, "extensions", "add", source, "--name", "pstdio-planner", "--force"],
        {
          cwd: folder,
          env: {
            ...process.env,
            PSTDIO_HOME: root,
            PSTDIO_API_URL: started.baseUrl,
            PSTDIO_API_TOKEN: started.descriptor.token,
          },
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      const [code, output, error] = await Promise.all([
        installing.exited,
        new Response(installing.stdout).text(),
        new Response(installing.stderr).text(),
      ]);
      if (code) throw new Error(`Planner install failed: ${output}\n${error}`);
    }
    const execute = async (command: string, params: Record<string, unknown> = {}) => {
      const result = await request(
        `/projects/${project.id}/extensions/commands/pstdio.pstdio-planner.command.${command}/execute`,
        { source: "api", params },
      );
      if (!result.outcome.ok) throw new Error(`${command}: ${JSON.stringify(result.outcome)}`);
      return result.outcome.value;
    };
    const tickets = await seedTickets(execute);
    const ticket = tickets.find((row) => row.title === "Benchmark ticket 0001")!;
    // Keep the benchmark ticket in the visible portion of the unfiltered 1,000-ticket board.
    const { views } = await request(`/projects/${project.id}/boards/pstdio.pstdio-planner.view.tickets/views`);
    await request(
      `/projects/${project.id}/board-views/${views[0].id}`,
      { sorts: [{ attributeId: "created", direction: "asc" }] },
      "PATCH",
    );
    const allWorkspaces = (await request(`/workspaces?project_id=${project.id}`)) as {
      id: string;
      is_default: boolean;
    }[];
    const rootWorkspace = allWorkspaces.find((row) => row.is_default)!;
    const linked = allWorkspaces.filter((row) => !row.is_default);
    while (linked.length < SUBNAV_WORKLOAD.linkedWorkspaces) {
      linked.push(
        await request("/workspaces", {
          project_id: project.id,
          provider_id: "pstdio.worktree",
          shorthand_base: ticket.shorthand,
          params: { base: "main" },
          anchors: [{ type: "ticket", extensionId: "pstdio.pstdio-planner", id: ticket.id, label: ticket.shorthand }],
        }),
      );
    }
    let sessions = (await request(`/sessions?project_id=${project.id}`)) as { id: string; title: string }[];
    while (sessions.length < SUBNAV_WORKLOAD.sessions) {
      const index = sessions.length;
      const workspace = index < 100 ? linked[Math.floor(index / 20)]! : rootWorkspace;
      const session = await request("/sessions", {
        project_id: project.id,
        workspace_id: workspace.id,
        title: `Benchmark session ${String(index + 1).padStart(4, "0")}`,
        agent: "test.subnav-fixture.harness.worker",
        prompt: "",
        ...(index >= 100 && index < 120
          ? {
              anchors: [
                { type: "ticket", extensionId: "pstdio.pstdio-planner", id: ticket.id, label: ticket.shorthand },
              ],
            }
          : {}),
      });
      sessions.push(session);
      if (sessions.length % 100 === 0) console.info(`Sessions ${sessions.length}/${SUBNAV_WORKLOAD.sessions}`);
    }
    sessions = await request(`/sessions?project_id=${project.id}`);
    if (
      tickets.length !== SUBNAV_WORKLOAD.tickets ||
      sessions.length !== SUBNAV_WORKLOAD.sessions ||
      linked.length !== SUBNAV_WORKLOAD.linkedWorkspaces
    )
      throw new Error("Fixture does not match the fixed workload");
    return { ...started, project, ticket, linked, rootWorkspace, request, execute, stop, workload: SUBNAV_WORKLOAD };
  } catch (error) {
    await stop();
    throw error;
  }
};
