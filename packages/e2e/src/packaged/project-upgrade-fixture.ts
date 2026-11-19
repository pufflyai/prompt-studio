import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import {
  createStackApi,
  importedSessionId,
  inParallel,
  type StackApi,
  writeLargeProjectFiles,
  writeSessionExport,
} from "pstdio-scripts/testing";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

export type ProjectUpgradeProfile = "active" | "aged";
export interface ProjectUpgradeInput {
  home: string;
  profile: ProjectUpgradeProfile;
  evidence: string;
}

const sizes = { files: 1000, tickets: 500, sessions: 150, worktrees: 3 };
const statuses = ["Backlog", "Todo", "In Progress", "Done"];
const editText = "Upgrade persisted this edit\n\nRésumé · 修正";
const sha256 = (content: string | Uint8Array) => createHash("sha256").update(content).digest("hex");
const sortById = <T extends { id: string }>(items: T[]) => items.sort((left, right) => left.id.localeCompare(right.id));
const transcriptDigest = (messages: unknown[]) =>
  sha256(
    JSON.stringify(messages, (_key, value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
    }),
  );

export const upgradeApi = (descriptor: { origin: string; token: string }) => {
  const origin = new URL(descriptor.origin);
  assert.equal(origin.hostname, "127.0.0.1", "Upgrade tests require an isolated loopback runtime");
  return createStackApi({ apiPort: Number(origin.port), apiToken: descriptor.token });
};

interface CommandInfo {
  id: string;
  localId?: string;
  extensionId: string;
}

interface ProjectExtension {
  id: string;
  extensionId: string;
  status: string;
  enabled: boolean;
  version: string | null;
  canUpgrade: boolean;
  lastError?: { code?: string };
}

export const installedProjectTools = async (api: StackApi, project: string) => {
  const { extensions } = await api.get<{ extensions: ProjectExtension[] }>(`/projects/${project}/extensions`);
  return extensions.map(({ id, enabled, version }) => ({ id, enabled, version }));
};

export const assertProjectToolsRetained = async (
  api: StackApi,
  project: string,
  before: Awaited<ReturnType<typeof installedProjectTools>>,
) => {
  const current = new Map((await installedProjectTools(api, project)).map((tool) => [tool.id, tool]));
  for (const previous of before) {
    const tool = current.get(previous.id);
    assert(tool, `Upgrade lost extension instance ${previous.id}`);
    assert.equal(tool.enabled, previous.enabled, `Enablement changed for ${tool.id}`);
    if (previous.version && tool.version !== previous.version)
      assert(
        tool.version && Bun.semver.order(tool.version, previous.version) >= 0,
        `Downgrade for ${tool.id}: ${previous.version} → ${tool.version}`,
      );
  }
};

export const upgradeCoreProjectTools = async (api: StackApi, project: string) => {
  const path = `/projects/${project}/extensions`;
  const { extensions } = await api.get<{ extensions: ProjectExtension[] }>(path);
  const changes: { extension: string; version: string | null; next: string | null }[] = [];
  for (const tool of extensions) {
    if (
      !/^pstdio\.((pstdio-)?(home|planner|session-browser)|harness-codex|git-workspaces)$/.test(tool.extensionId) ||
      !tool.enabled
    )
      continue;
    assert.notEqual(
      tool.lastError?.code,
      "extension_identity_conflict",
      `${tool.extensionId} has conflicting histories`,
    );
    if (tool.lastError?.code !== "extension_manifest_unsupported_api_version") {
      assert.notEqual(tool.status, "error", `${tool.extensionId}: ${tool.lastError?.code ?? "load error"}`);
      continue;
    }
    assert(tool.canUpgrade, `${tool.extensionId} is incompatible and has no supported upgrade`);
    const { extension } = await api.post<{ extension: ProjectExtension }>(`${path}/${tool.id}/upgrade`, {});
    assert.equal(extension.id, tool.id, "Upgrade replaced the registered instance");
    assert.equal(extension.enabled, true, "Upgrade disabled an enabled extension");
    assert.equal(extension.status, "loaded", `${tool.extensionId} upgrade failed`);
    changes.push({ extension: tool.extensionId, version: tool.version, next: extension.version });
  }
  return changes;
};

const planner = async (api: StackApi, project: string) => {
  const { commands, diagnostics } = await api.get<{ commands: CommandInfo[]; diagnostics: unknown[] }>(
    `/projects/${project}/extensions/commands`,
  );
  const known = new Map(
    commands
      .filter((item) => /^pstdio\.(pstdio-)?planner$/.test(item.extensionId))
      .map(({ extensionId, localId, id }) => [localId ?? id.slice(`${extensionId}.command.`.length), id]),
  );
  assert(known.has("create-ticket"), `Planner is unavailable: ${JSON.stringify(diagnostics).slice(0, 1000)}`);
  const execute = <T>(name: string, params?: Record<string, unknown>) => {
    const command = known.get(name);
    assert(command, `Planner does not expose ${name}`);
    return api.command<T>(project, command, params);
  };
  return {
    execute,
    supportsImport: known.has("import-tickets"),
    upload: async (body: string) =>
      (
        await api.raw(`/projects/${project}/extensions/commands/${known.get("create-ticket")}/files`, {
          method: "POST",
          body,
          headers: { "content-type": "application/octet-stream", "x-file-name": "handoff.txt" },
        })
      ).json(),
  };
};

interface Attachment {
  id: string;
  name: string;
}

interface Ticket {
  id: string;
  title: string;
  content: string;
  shorthand: string;
  statusId: string | null;
  parentId: string | null;
  dependsOn: string[];
  tagIds: string[];
  archived: boolean;
  attachments?: Attachment[];
}

interface Workspace {
  id: string;
  shorthand: string;
  root_path: string | null;
  branch: string | null;
  is_default: boolean;
  provider_state: string;
}

interface BoardView {
  id: string;
  title: string;
  filter: unknown;
  sorts: unknown;
  settings: unknown;
}

interface Seed {
  id: string;
  name: string;
  archivedId: string | null;
  deletedId: string | null;
  folder: string;
  firstTicket: string;
  linkedSession: string;
  linkedWorkspace: string;
  sessionIds: string[];
  worktreeIds: string[];
  viewId: string;
}

const createWorktree = async (api: StackApi, project: string) => {
  const workspace = await api.post<Workspace>("/workspaces", {
    project_id: project,
    provider_id: "pstdio.worktree",
    params: { base: "HEAD" },
  });
  return workspace.id;
};

const workspaces = (api: StackApi, project: string) => api.get<Workspace[]>(`/workspaces?project_id=${project}`);

const plannerViewsPath = async (api: StackApi, project: string) => {
  const prefix = `/projects/${project}/boards`;
  const boards = await api.get<{ id: string }[]>(prefix);
  const board = boards.find(({ id }) => /^pstdio\.(pstdio-)?planner\.view\.tickets$/.test(id));
  assert(board, "Planner ticket board is unavailable");
  return `${prefix}/${board.id}/views`;
};

const readyWorktrees = async (api: StackApi, project: string, ids: string[]) => {
  const deadline = Date.now() + PACKAGED_TEST_TIMEOUT;
  for (;;) {
    const rows = await workspaces(api, project);
    const saved = rows.filter(({ id }) => ids.includes(id));
    assert.equal(saved.length, ids.length, "The project did not retain every Git worktree");
    // Runtime readiness can precede reconciliation of the stored workspace projections.
    const providers = await api.get<{ id: string }[]>(`/projects/${project}/workspace-providers`);
    const providerAvailable = providers.some(({ id }) => id === "pstdio.worktree");
    if (providerAvailable && saved.every(({ provider_state }) => provider_state === "ready")) return rows;
    assert(
      Date.now() < deadline,
      `Existing Git worktrees must stay ready (provider available: ${providerAvailable}): ${saved
        .map(({ shorthand, provider_state }) => `${shorthand}=${provider_state}`)
        .join(", ")}`,
    );
    await Bun.sleep(250);
  }
};

const importConversations = async (
  api: StackApi,
  input: ProjectUpgradeInput,
  project: { id: string; name: string },
) => {
  const sourceId = "upgrade-conversations";
  const sourcePath = join(input.home, "export");
  const ids = writeSessionExport(sourcePath, [
    {
      sourceId,
      name: project.name,
      sessions: sizes.sessions,
      longTranscripts: input.profile === "aged",
    },
  ]).get(sourceId)!;
  type ImportJob = { id: string; status: string; imported: number; failed: number };
  let job = await api.post<ImportJob>("/session-imports", { sourcePath, projectMap: { [sourceId]: project.id } });
  const deadline = Date.now() + PACKAGED_TEST_TIMEOUT;
  while (job.status === "running") {
    assert(Date.now() < deadline, "Conversation import did not finish");
    await Bun.sleep(250);
    job = await api.get<ImportJob>(`/session-imports/${job.id}`);
  }
  assert.equal(job.status, "completed", "Conversation import completion");
  assert.equal(job.failed, 0, "Conversation import errors");
  assert.equal(job.imported, sizes.sessions, "Imported conversations");
  return ids.map((id) => importedSessionId(id, project.id));
};

const seedTickets = async (commands: Awaited<ReturnType<typeof planner>>, profile: ProjectUpgradeProfile) => {
  const input = Array.from({ length: sizes.tickets }, (_, index) => {
    const title = `${profile === "aged" ? "Maintenance" : "Feature"} ${index + 1}`;
    return {
      key: String(index),
      content: `# ${title}\n\n${profile === "aged" ? "Résumé · 修正 · Older review notes. ".repeat(index % 10 === 0 ? 200 : 4) : "Implementation and verification notes."}`,
      status: statuses[index % statuses.length],
      ...(index % 10 === 0 ? {} : { parent: String(index - (index % 10)), dependsOn: [String(index - 1)] }),
    };
  });
  if (commands.supportsImport) {
    const result = await commands.execute<{ tickets: Record<string, { id: string }> }>("import-tickets", {
      tickets: input,
    });
    return input.map(({ key }) => result.tickets[key]!.id);
  }
  const ids: string[] = [];
  for (const { key: _, parent, dependsOn, ...ticket } of input) {
    const created = await commands.execute<Ticket>("create-ticket", {
      ...ticket,
      ...(parent ? { parentId: ids[Number(parent)] } : {}),
      ...(dependsOn ? { dependsOn: dependsOn.map((index) => ids[Number(index)]!) } : {}),
    });
    ids.push(created.id);
  }
  return ids;
};

export const seedUpgradeProject = async (api: StackApi, input: ProjectUpgradeInput) => {
  const folder = join(input.home, "project");
  const name = `Upgrade ${input.profile}`;
  writeLargeProjectFiles(folder, sizes.files);
  // Aged homes carry uncommitted historical files in addition to the Git tree.
  if (input.profile === "aged")
    await Bun.write(join(folder, "handoff.txt"), "Historical handoff · 修正\n".repeat(6000));
  const project = await api.post<{ id: string; name: string }>("/projects", folderProjectInput({ name }, folder));
  const prefix = `/projects/${project.id}`;
  console.log("[upgrade fixture] Preparing Home, Planner, Git Workspaces, and the conversation harness");
  const { marketplace, extensions } = await api.get<{
    marketplace: { installName: string }[];
    extensions: ProjectExtension[];
  }>(`${prefix}/extensions`);
  const plannerEntry = marketplace.find(({ installName }) => /^(pstdio-)?planner$/.test(installName));
  assert(plannerEntry, "The published baseline must offer Planner");
  await api.post(`${prefix}/extensions/install`, { source: { kind: "catalog", name: plannerEntry.installName } });
  // The generated history belongs to the Codex harness. The reader needs its declaration to open it.
  const enabled = new Set(extensions.filter(({ enabled }) => enabled).map(({ extensionId }) => extensionId));
  if (![...enabled].some((id) => /^pstdio\.(pstdio-)?home$/.test(id))) {
    const entry = marketplace.find(({ installName }) => /^(pstdio-)?home$/.test(installName));
    assert(entry, "The published baseline must offer Home");
    await api.post(`${prefix}/extensions/install`, { source: { kind: "catalog", name: entry.installName } });
  }
  if (!enabled.has("pstdio.harness-codex"))
    await api.post(`${prefix}/extensions/install`, { source: { kind: "catalog", name: "harness-codex" } });
  // Older releases supply the Git provider directly.
  if (!enabled.has("pstdio.git-workspaces") && marketplace.some(({ installName }) => installName === "git-workspaces"))
    await api.post(`${prefix}/extensions/install`, { source: { kind: "catalog", name: "git-workspaces" } });
  const commands = await planner(api, project.id);
  console.log("[upgrade fixture] Creating worktrees and conversations");
  const worktreeIds: string[] = [];
  for (let index = 0; index < sizes.worktrees; index++) worktreeIds.push(await createWorktree(api, project.id));
  await readyWorktrees(api, project.id, worktreeIds);
  const sessionIds = await importConversations(api, input, project);
  console.log(`[upgrade fixture] Creating ${sizes.tickets} Planner tickets`);
  const ticketIds = await seedTickets(commands, input.profile);
  const firstTicket = ticketIds[0]!;
  const linkedWorkspace = worktreeIds[0]!;
  const linkedSession = sessionIds[1]!;
  const ref = await commands.upload("Saved project handoff · 修正. ".repeat(input.profile === "aged" ? 6000 : 6));
  await commands.execute("attach-file", { ticketId: firstTicket, ref });
  await api.post(`${prefix}/resource-anchors/add`, {
    resource: { type: "ticket", id: firstTicket },
    anchors: [
      { type: "workspace", id: linkedWorkspace },
      ...sessionIds.slice(0, 12).map((id) => ({ type: "session", id })),
    ],
  });
  const views = await plannerViewsPath(api, project.id);
  const view = await api.post<BoardView>(views, { title: `${name} saved view` });
  await api.put(`${views}/default`, { viewId: view.id });
  let deletedId: string | null = null;
  let archivedId: string | null = null;
  if (input.profile === "aged") {
    archivedId = ticketIds[10]!;
    await commands.execute("archive-ticket", { id: archivedId });
    await commands.execute("update-ticket", {
      id: ticketIds[20],
      content: "# Updated before the upgrade\n\nArchived review notes.",
    });
    const removed = await commands.execute<Ticket>("create-ticket", { title: "Delete before upgrading" });
    await commands.execute("delete-ticket", { id: removed.id });
    deletedId = removed.id;
  }
  return {
    id: project.id,
    name,
    archivedId,
    deletedId,
    folder,
    firstTicket,
    linkedSession,
    linkedWorkspace,
    sessionIds,
    worktreeIds,
    viewId: view.id,
  } satisfies Seed;
};

const files = async (folder: string) => {
  const paths = (await readdir(folder, { recursive: true, withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.parentPath
          .slice(folder.length)
          .split(/[\\/]/)
          .some((part) => part === ".git" || part === ".pstdio"),
    )
    .map((entry) => join(entry.parentPath, entry.name));
  const digests: Record<string, string> = {};
  await inParallel(paths, 16, async (path) => {
    digests[path.slice(folder.length + 1)] = sha256(await readFile(path));
  });
  return digests;
};

export const readUpgradeProject = async (api: StackApi, seed: Seed) => {
  const prefix = `/projects/${seed.id}`;
  const projects = await api.get<{ id: string; name: string }[]>("/projects");
  assert.equal(projects.find(({ id }) => id === seed.id)?.name, seed.name, "Original project is missing");
  const commands = await planner(api, seed.id);
  const rows = await commands.execute<Ticket[]>("read-tickets");
  if (seed.archivedId) {
    const archived = await commands.execute<Ticket>("get-ticket", { id: seed.archivedId });
    assert(archived.archived, "Archived ticket must stay archived");
    rows.push(archived);
  }
  assert.equal(rows.length, sizes.tickets, "Planner ticket count changed");
  assert.equal(new Set(rows.map(({ id }) => id)).size, sizes.tickets, "Planner ticket identities must be unique");
  if (seed.deletedId)
    assert.equal(await commands.execute("get-ticket", { id: seed.deletedId }), null, "A deleted ticket reappeared");
  const tickets = sortById(
    rows.map(({ id, title, content, shorthand, statusId, parentId, dependsOn, tagIds, archived }) => ({
      id,
      title,
      content: sha256(content ?? ""),
      shorthand,
      statusId,
      parentId,
      dependsOn,
      tagIds,
      archived,
    })),
  );
  const attached = (await commands.execute<Ticket>("get-ticket", { id: seed.firstTicket })).attachments;
  assert.equal(attached?.length, 1, "The first ticket must keep its attachment");
  const attachment = attached![0]!;
  const { dataUrl } = await commands.execute<{ dataUrl: string }>("read-ticket-attachment", {
    ticketId: seed.firstTicket,
    attachmentId: attachment.id,
  });
  const attachmentBytes = Buffer.from(dataUrl.split(",")[1]!, "base64");
  assert(attachmentBytes.length > 0, "The attached file is empty");
  const workspaceRows = sortById(await readyWorktrees(api, seed.id, seed.worktreeIds)).map(
    ({ id, shorthand, root_path, branch, is_default, provider_state }) => ({
      id,
      shorthand,
      root_path,
      branch,
      is_default,
      provider_state,
    }),
  );
  const worktreeRoot = workspaceRows.find(({ id }) => id === seed.linkedWorkspace)?.root_path;
  assert(worktreeRoot, "The linked Git worktree must keep its file root");
  const localPath = relative(await realpath(dirname(seed.folder)), await realpath(worktreeRoot));
  assert(
    localPath && !isAbsolute(localPath) && localPath !== ".." && !localPath.startsWith(`..${sep}`),
    "Worktree is outside the test home",
  );
  const worktreeFile = await readFile(join(worktreeRoot, "large-project/area-00/module-00/notes-00000.md"));
  const links = await api.post<{ items: { target: { id: string; type: string; role?: string } }[] }>(
    `${prefix}/resource-anchors/query`,
    { resource: { type: "ticket", id: seed.firstTicket }, direction: "outgoing" },
  );
  assert(
    links.items.some(({ target }) => target.id === seed.linkedWorkspace),
    "Ticket's workspace link is missing",
  );
  assert(
    links.items.some(({ target }) => target.id === seed.linkedSession),
    "Ticket's conversation link is missing",
  );
  const sessions: { id: string; title: string; archived: boolean; messages: string }[] = [];
  await inParallel(seed.sessionIds, 4, async (id) => {
    const { session, messages } = await api.get<{ session: { title: string; archived: boolean }; messages: unknown[] }>(
      `/sessions/${id}/conversation`,
    );
    assert(messages.length > 0, `Conversation ${id} is empty`);
    sessions.push({ id, title: session.title, archived: session.archived, messages: transcriptDigest(messages) });
  });
  const view = await api.get<BoardView>(`${prefix}/board-views/${seed.viewId}`);
  const { defaultViewId } = await api.get<{ defaultViewId: string }>(await plannerViewsPath(api, seed.id));
  assert.equal(defaultViewId, seed.viewId, "Planner's default saved view changed");
  const tree = await files(seed.folder);
  assert(Object.keys(tree).length >= sizes.files, "Project files are missing");
  return {
    tickets,
    attachment: { id: attachment.id, name: attachment.name, sha256: sha256(attachmentBytes) },
    workspaces: workspaceRows,
    worktreeFile: sha256(worktreeFile),
    sessions: sortById(sessions),
    links: sortById(links.items.map(({ target }) => ({ id: target.id, type: target.type, role: target.role }))),
    view: { id: view.id, title: view.title, filter: view.filter, sorts: view.sorts, settings: view.settings },
    files: tree,
  };
};

export const editUpgradeProject = async (api: StackApi, seed: Seed) => {
  const commands = await planner(api, seed.id);
  await commands.execute("update-ticket", { id: seed.firstTicket, content: `# ${editText}` });
  const saved = await commands.execute<Ticket>("get-ticket", { id: seed.firstTicket });
  assert.equal(saved.content, `# ${editText}`);
};

export const assertUpgradeEdit = async (api: StackApi, seed: Seed) => {
  const commands = await planner(api, seed.id);
  const saved = await commands.execute<Ticket>("get-ticket", { id: seed.firstTicket });
  assert.equal(saved.content, `# ${editText}`, "A ticket edit failed to survive restart");
};
