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
  // Each worktree workspace is a full checkout, so they are opt-in.
  workspaces: count("PSTDIO_LARGE_WORKSPACES", 0),
  sessions: count("PSTDIO_LARGE_SESSIONS", 1000),
});
const log = (message: string) => process.stderr.write(`[large] ${message}\n`);
const seconds = (start: number) => `${((performance.now() - start) / 1000).toFixed(1)} s`;

interface Project {
  id: string;
  name: string;
  folder: string;
}

const ensureProject = async (api: StackApi, name: string, folder: string, files: number) => {
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
  return { id: project.id, name, folder } satisfies Project;
};

// Worktree workspaces come from the Git workspaces extension, which new projects do not enable by default.
// Enabling re-provisions every workspace, so it runs only while workspaces are still missing.
const enableWorktrees = async (api: StackApi, repoRoot: string, project: Project) => {
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
};

type Link = { workspace: string } | { session: string };
const IMPORT_BATCH = 1000;

// Tickets form epics of ten (parent and children) and five interleaved dependency tracks. They are
// created with Planner's import-tickets, up to 1,000 per call, together with their links.
const seedTickets = async (
  api: StackApi,
  project: Project,
  label: string,
  total: number,
  linksFor: (index: number) => Link[],
) => {
  const prefix = `${label}-`;
  const existing = await api.command<{ id: string; title: string }[]>(project.id, `${PLANNER}.read-tickets`);
  const ids: string[] = [];
  for (const ticket of existing) {
    const match = ticket.title.match(new RegExp(`^${prefix}(\\d+):`));
    if (match) ids[Number(match[1]) - 1] = ticket.id;
  }
  const missing = Array.from({ length: total }, (_, index) => index).filter((index) => !ids[index]);
  const msPerTicketByImport: number[] = [];
  for (let offset = 0; offset < missing.length; offset += IMPORT_BATCH) {
    const batch = missing.slice(offset, offset + IMPORT_BATCH);
    const keys = new Set(batch.map((index) => `${prefix}${index + 1}`));
    // A parent or prerequisite is a key in this batch or an already created ticket.
    const ref = (index: number) => (keys.has(`${prefix}${index + 1}`) ? `${prefix}${index + 1}` : ids[index]!);
    const tickets = batch.map((index) => {
      const isEpic = index % 10 === 0;
      const title = `${prefix}${index + 1}: ${TOPICS[index % TOPICS.length]} the ${AREAS[index % AREAS.length]}`;
      const links = linksFor(index);
      return {
        key: `${prefix}${index + 1}`,
        content: `# ${title}\n\n${"Describe the expected behaviour, the evidence and the checks that prove it. ".repeat(isEpic ? 12 : 4)}`,
        status: STATUSES[index % STATUSES.length],
        ...(isEpic ? {} : { parent: ref(index - (index % 10)) }),
        ...(index >= 5 && !isEpic ? { dependsOn: [ref(index - 5)] } : {}),
        ...(links.length ? { links } : {}),
      };
    });
    const started = performance.now();
    const result = await api.command<{ tickets: Record<string, { id: string }> }>(
      project.id,
      `${PLANNER}.import-tickets`,
      { tickets },
    );
    msPerTicketByImport.push(Math.round(((performance.now() - started) / batch.length) * 10) / 10);
    for (const index of batch) ids[index] = result.tickets[`${prefix}${index + 1}`]!.id;
    log(
      `${project.name}: ${offset + batch.length}/${missing.length} tickets imported (${msPerTicketByImport.at(-1)} ms each)`,
    );
  }
  const links = Array.from({ length: total }, (_, index) => linksFor(index).length).reduce(
    (sum, count) => sum + count,
    0,
  );
  return { ids, msPerTicketByImport, links };
};

const seedWorkspaces = async (api: StackApi, repoRoot: string, project: Project, total: number) => {
  type Workspace = { id: string; is_default: boolean; provider_state: string };
  const ready = async () =>
    (await api.get<Workspace[]>(`/workspaces?project_id=${project.id}`)).filter(
      (row) => !row.is_default && row.provider_state === "ready",
    );
  const missing = Math.max(0, total - (await ready()).length);
  if (missing > 0) await enableWorktrees(api, repoRoot, project);
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
  return (await ready()).map((row) => row.id);
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
  const deadline = Date.now() + 60 * 60_000;
  while (job.status === "running" || job.status === "paused") {
    if (Date.now() > deadline) throw new Error(`Session import did not finish within an hour: ${JSON.stringify(job)}`);
    // A runtime restart pauses the job; resuming continues where it stopped.
    if (job.status === "paused") await api.post(`/session-imports/${job.id}/resume`, {});
    await Bun.sleep(3_000);
    job = await api.get<Job>(`/session-imports/${job.id}`);
  }
  if (job.status !== "completed") throw new Error(`Session import ${job.status}: ${JSON.stringify(job)}`);
  if (job.failed > 0)
    log(`session import finished with ${job.failed} failed sessions; see /v1/session-imports/${job.id}/errors`);
  return new Map(
    projects.map((project, index) => [
      project.id,
      (sources.get(`large-source-${index + 1}`) ?? []).map((id) => importedSessionId(id, project.id)),
    ]),
  );
};

// Each workspace links to one ticket and every second session to another, spread across the project.
const linkPlan = (total: number, workspaces: string[], sessions: string[]) => {
  const links = new Map<number, Link[]>();
  const add = (index: number, link: Link) => links.set(index, [...(links.get(index) ?? []), link]);
  for (const [index, workspace] of workspaces.entries()) add((index * 7) % total, { workspace });
  for (const [index, session] of sessions.filter((_, position) => position % 2 === 1).entries())
    add((index * 13) % total, { session });
  return (index: number) => links.get(index) ?? [];
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
      await ensureProject(api, `Large ${index}`, join(stackDirectory, "large-projects", `large-${index}`), size.files),
    );

  log(`seeding ${size.workspaces} workspaces per project`);
  const workspaces = await Promise.all(
    projects.map((project) => seedWorkspaces(api, repoRoot, project, size.workspaces)),
  );

  log(`importing ${size.sessions} sessions per project`);
  const sessions = await importSessions(api, join(stackDirectory, "large-session-export"), projects, size.sessions);

  log(`importing ${size.tickets} tickets per project with their links`);
  const report = await Promise.all(
    projects.map(async (project, index) => {
      const projectSessions = sessions.get(project.id) ?? [];
      const linksFor = linkPlan(size.tickets, workspaces[index]!, projectSessions);
      const tickets = await seedTickets(api, project, `L${index + 1}`, size.tickets, linksFor);
      return {
        project: project.name,
        projectId: project.id,
        url: `${connection.dashboardUrl.replace(/\/$/, "")}/projects/${project.id}/`,
        tickets: tickets.ids.filter(Boolean).length,
        msPerTicketByImport: tickets.msPerTicketByImport,
        workspaces: workspaces[index]!.length,
        sessions: projectSessions.length,
        links: tickets.links,
      };
    }),
  );
  log(`done in ${seconds(started)}`);
  return report;
};

if (import.meta.main) {
  const [connectionPath] = process.argv.slice(2);
  if (!connectionPath) throw new Error("Pass the stack's connection.json path.");
  process.stdout.write(`${JSON.stringify(await seedLargeProject(connectionPath), null, 2)}\n`);
}
