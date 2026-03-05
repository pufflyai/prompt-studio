import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, createProjectViaApi } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { runTuiScenario, TUI_KEYS, type TuiStep } from "./tui-harness";

type Project = { id: string; name: string };
type Ticket = { id: string; title: string | null; status_id: string | null; archived: boolean };
type Template = { id: string; name: string; template_type: string; is_default: boolean };
type Agent = { id: string; agent_id: string; is_default: boolean };

let api: ApiInstance;
const dirs: string[] = [];

beforeAll(async () => {
  api = await startApi();
}, 20_000);

afterAll(() => {
  api?.stop();
});

afterEach(() => {
  cleanupDirs(dirs);
});

const createRepoWithProject = async (name: string) => {
  const repo = createGitRepo();
  dirs.push(repo);

  const project = (await createProjectViaApi(api.url, name)) as Project;
  mkdirSync(join(repo, ".pstdio"), { recursive: true });
  writeFileSync(join(repo, ".pstdio", "config.json"), `${JSON.stringify({ project_id: project.id }, null, 2)}\n`);

  return { repo, project };
};

const createTicket = async (projectId: string, title: string) => {
  const res = await fetch(`${api.url}/v1/tickets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, title }),
  });

  if (!res.ok) throw new Error(`Failed to create ticket: ${res.status}`);
  return (await res.json()) as Ticket;
};

const getTicket = async (ticketId: string) => {
  const res = await fetch(`${api.url}/v1/tickets/${ticketId}`);
  if (!res.ok) throw new Error(`Failed to fetch ticket: ${res.status}`);
  return (await res.json()) as Ticket;
};

const listTickets = async (projectId: string) => {
  const res = await fetch(`${api.url}/v1/tickets?project_id=${encodeURIComponent(projectId)}`);
  if (!res.ok) throw new Error(`Failed to list tickets: ${res.status}`);
  return (await res.json()) as Ticket[];
};

const createTemplate = async (projectId: string, name: string, isDefault = false) => {
  const res = await fetch(`${api.url}/v1/projects/${projectId}/templates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      template_type: "ticket",
      content: `# ${name}\n`,
      is_default: isDefault,
    }),
  });

  if (!res.ok) throw new Error(`Failed to create template: ${res.status}`);
  return (await res.json()) as Template;
};

const listTemplates = async (projectId: string) => {
  const res = await fetch(`${api.url}/v1/projects/${projectId}/templates`);
  if (!res.ok) throw new Error(`Failed to list templates: ${res.status}`);
  return (await res.json()) as Template[];
};

const listAgents = async () => {
  const res = await fetch(`${api.url}/v1/agents`);
  if (!res.ok) throw new Error(`Failed to list agents: ${res.status}`);
  return (await res.json()) as Agent[];
};

const run = (repo: string, steps: TuiStep[], timeoutMs?: number) =>
  runTuiScenario({
    cwd: repo,
    apiUrl: api.url,
    steps,
    timeoutMs,
  });

describe("pstdio tui e2e coverage", () => {
  test("covers tickets create + search flow", async () => {
    const { repo, project } = await createRepoWithProject("tui-tickets-create-search");
    const ticketTitle = "TUI e2e search ticket";
    await createTicket(project.id, ticketTitle);

    run(repo, [
      { type: "expect", text: project.name },
      { type: "expect", text: ticketTitle },
      { type: "send", text: "/" },
      { type: "expect", text: "enter:confirm esc:cancel" },
      { type: "type", text: "missing term" },
      { type: "send", text: TUI_KEYS.ESC },
      { type: "expect", text: ticketTitle },
      { type: "send", text: "n" },
      { type: "expect", text: "New Ticket" },
      { type: "send", text: TUI_KEYS.ESC },
      { type: "expect", text: ticketTitle },
      { type: "send", text: "q" },
    ]);

    const tickets = await listTickets(project.id);
    expect(tickets.some((ticket) => ticket.title === ticketTitle)).toBe(true);
  }, 30_000);

  test("covers opening and closing the status picker from tickets", async () => {
    const { repo, project } = await createRepoWithProject("tui-ticket-status-picker");
    const ticket = await createTicket(project.id, "TUI status picker ticket");

    run(repo, [
      { type: "expect", text: ticket.title ?? "" },
      { type: "send", text: TUI_KEYS.DOWN },
      { type: "sleep", ms: 150 },
      { type: "send", text: "e" },
      { type: "expect", text: "Set Status" },
      { type: "send", text: TUI_KEYS.ESC },
      { type: "expect", text: ticket.title ?? "" },
      { type: "send", text: "q" },
    ]);
  }, 30_000);

  test("covers archive confirmation overlay open/cancel flow", async () => {
    const { repo, project } = await createRepoWithProject("tui-ticket-archive");
    const ticket = await createTicket(project.id, "TUI archive ticket");

    run(repo, [
      { type: "expect", text: "TUI archive ticket" },
      { type: "send", text: TUI_KEYS.DOWN },
      { type: "sleep", ms: 150 },
      { type: "send", text: "x" },
      { type: "expect", text: 'Archive "TUI archive ticket"?' },
      { type: "send", text: TUI_KEYS.ESC },
      { type: "expect", text: "TUI archive ticket" },
      { type: "send", text: "q" },
    ]);

    const updated = await getTicket(ticket.id);
    expect(updated.archived).toBe(false);
  }, 30_000);

  test("covers docs tab navigation and docs search input mode", async () => {
    const { repo, project } = await createRepoWithProject("tui-docs-tab");
    const docsDir = join(repo, ".pstdio", "docs");

    mkdirSync(docsDir, { recursive: true });
    writeFileSync(
      join(docsDir, "navigation.json"),
      `${JSON.stringify(
        {
          sidebar: [
            {
              text: "Guide",
              items: [{ text: "Overview", link: "/overview" }],
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(join(docsDir, "overview.md"), "# Overview\n\nHello from docs tab.\n");

    run(repo, [
      { type: "expect", text: project.name },
      { type: "expect", text: "No tickets found. Press n to create one." },
      { type: "send", text: "2" },
      { type: "expect", text: "Guide" },
      { type: "send", text: "/" },
      { type: "expect", text: "enter:confirm esc:cancel" },
      { type: "type", text: "missing" },
      { type: "send", text: TUI_KEYS.ESC },
      { type: "expect", text: "Guide" },
      { type: "send", text: "q" },
    ]);
  }, 30_000);

  test("covers templates tab list actions and default switching", async () => {
    const { repo, project } = await createRepoWithProject("tui-templates-tab");
    const templateA = "a-e2e-ticket-template";
    const templateB = "b-e2e-ticket-template";

    await createTemplate(project.id, templateA);
    await createTemplate(project.id, templateB);

    run(repo, [
      { type: "expect", text: project.name },
      { type: "expect", text: "No tickets found. Press n to create one." },
      { type: "send", text: "3" },
      { type: "expect", text: templateA },
      { type: "send", text: "d" },
      { type: "send", text: TUI_KEYS.DOWN },
      { type: "sleep", ms: 150 },
      { type: "expect", text: templateB },
      { type: "send", text: "d" },
      { type: "expect", text: templateA },
      { type: "send", text: "q" },
    ]);

    const templates = await listTemplates(project.id);
    const ticketTemplates = templates.filter((template) => template.template_type === "ticket");
    const defaultTemplate = ticketTemplates.find((template) => template.is_default);

    expect(defaultTemplate?.name).toBe(templateB);
  }, 30_000);

  test("covers tab switching and global overlays (help, projects, agents)", async () => {
    const repo = createGitRepo();
    dirs.push(repo);

    const projectA = (await createProjectViaApi(api.url, "tui-global-a")) as Project;
    await createProjectViaApi(api.url, "tui-global-b");

    mkdirSync(join(repo, ".pstdio"), { recursive: true });
    writeFileSync(join(repo, ".pstdio", "config.json"), `${JSON.stringify({ project_id: projectA.id }, null, 2)}\n`);

    run(repo, [
      { type: "expect", text: projectA.name },
      { type: "send", text: TUI_KEYS.TAB },
      { type: "expect", text: "▸ Docs" },
      { type: "send", text: TUI_KEYS.SHIFT_TAB },
      { type: "expect", text: "▸ Tickets" },
      { type: "send", text: "?" },
      { type: "expect", text: "Keyboard Shortcuts" },
      { type: "send", text: TUI_KEYS.ESC },
      { type: "expect", text: "No tickets found. Press n to create one." },
      { type: "send", text: "p" },
      { type: "expect", text: "Switch Project" },
      { type: "send", text: TUI_KEYS.ESC },
      { type: "sleep", ms: 150 },
      { type: "send", text: "a" },
      { type: "expect", text: "Manage Agents" },
      { type: "send", text: "s" },
      { type: "sleep", ms: 400 },
      { type: "send", text: "d" },
      { type: "sleep", ms: 400 },
      { type: "send", text: TUI_KEYS.ESC },
      { type: "send", text: "q" },
    ]);

    const agents = await listAgents();
    expect(agents.length).toBeGreaterThan(0);
  }, 30_000);

  test("covers realtime sync by applying external ticket changes while tui is open", async () => {
    const { repo, project } = await createRepoWithProject("tui-realtime-sync");
    const title = "TUI realtime external change";

    run(
      repo,
      [
        { type: "expect", text: project.name },
        { type: "expect", text: "No tickets found. Press n to create one." },
        {
          type: "exec",
          command: `curl -sS -X POST '${api.url}/v1/tickets' -H 'content-type: application/json' -d '{"project_id":"${project.id}","title":"${title}"}' > /dev/null`,
        },
        { type: "expect", text: title },
        { type: "send", text: "q" },
      ],
      40_000,
    );

    const tickets = await listTickets(project.id);
    expect(tickets.some((ticket) => ticket.title === title)).toBe(true);
  }, 40_000);
});
