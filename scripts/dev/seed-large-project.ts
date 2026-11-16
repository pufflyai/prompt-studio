// Seeds an isolated stack with several large, connected projects through product APIs only:
// folder projects with committed files, Planner tickets with parents and dependencies, worktree
// workspaces, imported sessions with transcripts, and ticket links to workspaces and sessions.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createStackApi, inParallel, type StackApi, type StackConnection } from "./large-project-api";
import { writeLargeProjectFiles } from "./large-project-files";
import { importedSessionId, writeSessionExport } from "./large-project-sessions";

const PLANNER = "pstdio.planner.command";
const STATUSES = ["Backlog", "Todo", "In Progress", "Done", "Done"];
const TOPICS = ["Fix", "Speed up", "Document", "Refactor", "Investigate"];
const AREAS = ["ticket board", "sync engine", "file tree", "session list", "workspace setup", "relay"];

const count = (name: string, fallback: number) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a whole number`);
  return value;
};
const sizes = () => ({
  projects: count("PSTDIO_LARGE_PROJECTS", 3),
  tickets: count("PSTDIO_LARGE_TICKETS", 3000),
  files: count("PSTDIO_LARGE_FILES", 5000),
  workspaces: count("PSTDIO_LARGE_WORKSPACES", 100),
  sessions: count("PSTDIO_LARGE_SESSIONS", 1000),
});
const log = (message: string) => process.stderr.write(`[large] ${message}\n`);
const seconds = (start: number) => `${((performance.now() - start) / 1000).toFixed(1)} s`;

interface Project {
  id: string;
  name: string;
  folder: string;
}

const ensureProject = async (api: StackApi, repoRoot: string, name: string, folder: string, files: number) => {
  writeLargeProjectFiles(folder, files);
  const existing = (await api.get<{ id: string; name: string }[]>("/projects")).find(
    (project) => project.name === name,
  );
  const project =
    existing ??
    (await api.post<{ id: string }>("/projects", {
      name,
      initial_workspace: { provider_id: "pstdio.root", params: { path: folder } },
    }));
  // Worktree workspaces come from the Git workspaces extension, which new projects do not enable by default.
  const sourcePath = join(repoRoot, "extensions", "git-workspaces");
  const manifest = JSON.parse(readFileSync(join(sourcePath, "package.json"), "utf8"));
  await api.post(`/projects/${project.id}/extensions/installed/git-workspaces/enable`, {
    name: "git-workspaces",
    displayName: "Git workspaces",
    extensionId: "pstdio.git-workspaces",
    manifest,
    sourcePath,
    sourceHash: null,
    sourceKind: "local_path",
    sourceRef: null,
    version: manifest.version,
  });
  return { id: project.id, name, folder } satisfies Project;
};

// Tickets form epics of ten (parent and children) and five interleaved dependency tracks.
const seedTickets = async (api: StackApi, project: Project, label: string, total: number) => {
  const prefix = `${label}-`;
  const existing = await api.command<{ id: string; title: string }[]>(project.id, `${PLANNER}.read-tickets`);
  const ids: string[] = [];
  for (const ticket of existing) {
    const match = ticket.title.match(new RegExp(`^${prefix}(\\d+):`));
    if (match) ids[Number(match[1]) - 1] = ticket.id;
  }
  const start = ids.findIndex((id) => id === undefined);
  const from = start === -1 ? ids.length : start;
  const buckets: number[] = [];
  let bucketStart = performance.now();
  for (let index = from; index < total; index++) {
    const isEpic = index % 10 === 0;
    const title = `${prefix}${index + 1}: ${TOPICS[index % TOPICS.length]} the ${AREAS[index % AREAS.length]}`;
    const created = await api.command<{ id: string }>(project.id, `${PLANNER}.create-ticket`, {
      content: `# ${title}\n\n${"Describe the expected behaviour, the evidence and the checks that prove it. ".repeat(isEpic ? 12 : 4)}`,
      status: STATUSES[index % STATUSES.length],
      ...(isEpic ? {} : { parent: ids[index - (index % 10)] }),
      ...(index >= 5 && !isEpic ? { dependsOn: [ids[index - 5]!] } : {}),
    });
    ids[index] = created.id;
    if ((index + 1) % 500 === 0) {
      buckets.push(Math.round((performance.now() - bucketStart) / 500));
      bucketStart = performance.now();
      log(`${project.name}: ${index + 1}/${total} tickets (${buckets.at(-1)} ms each for the last 500)`);
    }
  }
  return { ids, msPerTicketBy500: buckets };
};

const seedWorkspaces = async (api: StackApi, project: Project, total: number) => {
  type Workspace = { id: string; is_default: boolean; provider_state: string };
  const current = (await api.get<Workspace[]>(`/workspaces?project_id=${project.id}`)).filter((row) => !row.is_default);
  const missing = Math.max(0, total - current.length);
  await inParallel(Array.from({ length: missing }), 2, async () => {
    for (let attempt = 1; ; attempt++) {
      try {
        await api.post("/workspaces", {
          project_id: project.id,
          provider_id: "pstdio.worktree",
          params: { base: "HEAD" },
        });
        return;
      } catch (error) {
        if (attempt >= 3) throw error;
        await Bun.sleep(1_000 * attempt);
      }
    }
  });
  return (await api.get<Workspace[]>(`/workspaces?project_id=${project.id}`))
    .filter((row) => !row.is_default)
    .map((row) => row.id);
};

const importSessions = async (api: StackApi, folder: string, projects: Project[], perProject: number) => {
  const sources = writeSessionExport(
    folder,
    projects.map((project, index) => ({
      sourceId: `large-source-${index + 1}`,
      name: project.name,
      sessions: perProject,
    })),
  );
  const projectMap = Object.fromEntries(projects.map((project, index) => [`large-source-${index + 1}`, project.id]));
  type Job = { id: string; status: string; processed: number; imported: number; skipped: number; failed: number };
  let job: Job;
  for (;;) {
    try {
      job = await api.post<Job>("/session-imports", { sourcePath: folder, projectMap });
      break;
    } catch (error) {
      if (!String(error).includes("409")) throw error;
      await Bun.sleep(3_000);
    }
  }
  while (job.status === "running" || job.status === "paused") {
    await Bun.sleep(3_000);
    job = await api.get<Job>(`/session-imports/${job.id}`);
  }
  if (job.status !== "completed") throw new Error(`Session import ${job.status}: ${JSON.stringify(job)}`);
  return new Map(
    projects.map((project, index) => [
      project.id,
      (sources.get(`large-source-${index + 1}`) ?? []).map((id) => importedSessionId(id, project.id)),
    ]),
  );
};

const linkResources = async (
  api: StackApi,
  project: Project,
  tickets: string[],
  workspaces: string[],
  sessions: string[],
) => {
  const links = [
    ...workspaces.map((workspace, index) => ({ id: tickets[(index * 7) % tickets.length]!, workspace })),
    ...sessions
      .filter((_, index) => index % 2 === 0)
      .map((session, index) => ({ id: tickets[(index * 13) % tickets.length]!, session })),
  ];
  let failed = 0;
  await inParallel(links, 4, async (link) => {
    await api.command(project.id, `${PLANNER}.link`, link).catch(() => failed++);
  });
  return { links: links.length - failed, failed };
};

export const seedLargeProject = async (connectionPath: string) => {
  const size = sizes();
  const connection = JSON.parse(readFileSync(connectionPath, "utf8")) as StackConnection;
  const api = createStackApi(connection);
  const stackDirectory = dirname(resolve(connectionPath));
  const repoRoot = resolve(import.meta.dirname, "../..");
  const started = performance.now();

  log(`creating ${size.projects} projects with ${size.files} committed files each`);
  const projects: Project[] = [];
  for (let index = 1; index <= size.projects; index++)
    projects.push(
      await ensureProject(
        api,
        repoRoot,
        `Large ${index}`,
        join(stackDirectory, "large-projects", `large-${index}`),
        size.files,
      ),
    );

  log(`seeding ${size.tickets} tickets and ${size.workspaces} workspaces per project`);
  const seeded = await Promise.all(
    projects.map(async (project, index) => {
      const tickets = await seedTickets(api, project, `L${index + 1}`, size.tickets);
      const workspaces = await seedWorkspaces(api, project, size.workspaces);
      return { project, tickets, workspaces };
    }),
  );

  log(`importing ${size.sessions} sessions per project`);
  const sessions = await importSessions(api, join(stackDirectory, "large-session-export"), projects, size.sessions);

  log("linking tickets to workspaces and sessions");
  const report = [];
  for (const { project, tickets, workspaces } of seeded) {
    const linked = await linkResources(api, project, tickets.ids, workspaces, sessions.get(project.id) ?? []);
    report.push({
      project: project.name,
      projectId: project.id,
      url: `${connection.dashboardUrl.replace(/\/$/, "")}/projects/${project.id}/`,
      tickets: tickets.ids.length,
      msPerTicketBy500: tickets.msPerTicketBy500,
      workspaces: workspaces.length,
      sessions: sessions.get(project.id)?.length ?? 0,
      ...linked,
    });
  }
  log(`done in ${seconds(started)}`);
  return report;
};

if (import.meta.main) {
  const [connectionPath] = process.argv.slice(2);
  if (!connectionPath) throw new Error("Pass the stack's connection.json path.");
  process.stdout.write(`${JSON.stringify(await seedLargeProject(connectionPath), null, 2)}\n`);
}
