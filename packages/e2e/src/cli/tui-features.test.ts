import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, createProjectViaApi } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { runTuiScenario, TUI_KEYS, type TuiStep } from "./tui-harness";

type Project = { id: string; name: string };
type Ticket = {
  id: string;
  title: string | null;
  status_id: string | null;
  archived: boolean;
};
type Template = { id: string; name: string; template_type: string; is_default: boolean };

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

const createTemplate = async (projectId: string, name: string, content: string) => {
  const res = await fetch(`${api.url}/v1/projects/${projectId}/templates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      template_type: "ticket",
      content,
      is_default: false,
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

const run = (repo: string, steps: TuiStep[], timeoutMs?: number) =>
  runTuiScenario({
    cwd: repo,
    apiUrl: api.url,
    steps,
    timeoutMs,
  });

describe("pstdio tui e2e features", () => {
  test("covers ticket content actions including status update and archive confirmation", async () => {
    const { repo, project } = await createRepoWithProject("tui-feature-ticket-content");
    const ticket = await createTicket(project.id, "TUI content actions ticket");

    run(repo, [
      { type: "expect", text: project.name },
      { type: "expect", text: ticket.title ?? "" },
      { type: "send", text: TUI_KEYS.DOWN },
      { type: "sleep", ms: 100 },
      { type: "send", text: TUI_KEYS.ENTER },
      { type: "expect", text: "Esc:back e:status i:implement x:archive" },
      { type: "send", text: TUI_KEYS.ESC },
      { type: "expect", text: ticket.title ?? "" },
      { type: "send", text: "e" },
      { type: "expect", text: "Set Status" },
      { type: "send", text: TUI_KEYS.DOWN },
      { type: "send", text: TUI_KEYS.ENTER },
      { type: "expect", text: ticket.title ?? "" },
      { type: "send", text: "x" },
      { type: "expect", text: 'Archive "TUI content actions ticket"?' },
      { type: "send", text: TUI_KEYS.ENTER },
      { type: "expect", text: "No tickets found. Press n to create one." },
      { type: "send", text: "q" },
    ]);

    const updated = await getTicket(ticket.id);
    expect(updated.status_id).not.toBeNull();
    expect(updated.archived).toBe(true);
  }, 40_000);

  test("covers docs and templates content views with direct tab jumps", async () => {
    const { repo, project } = await createRepoWithProject("tui-feature-docs-templates");
    const docsDir = join(repo, ".pstdio", "docs");
    const templateName = "feature-template";
    const templateBody = "Template body from e2e.";
    const docsBody = "Docs panel body text.";

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
    writeFileSync(join(docsDir, "overview.md"), `# Overview\n\n${docsBody}\n`);

    await createTemplate(project.id, templateName, templateBody);

    run(repo, [
      { type: "expect", text: project.name },
      { type: "send", text: "2" },
      { type: "expect", text: "▸ Docs" },
      { type: "expect", text: "Guide" },
      { type: "send", text: TUI_KEYS.ENTER },
      { type: "expect", text: "Overview" },
      { type: "send", text: TUI_KEYS.DOWN },
      { type: "sleep", ms: 100 },
      { type: "send", text: TUI_KEYS.ENTER },
      { type: "expect", text: docsBody },
      { type: "send", text: TUI_KEYS.ESC },
      { type: "expect", text: "Guide" },
      { type: "send", text: "3" },
      { type: "expect", text: "▸ Templates" },
      { type: "expect", text: templateName },
      { type: "send", text: TUI_KEYS.ENTER },
      { type: "expect", text: "type: ticket" },
      { type: "expect", text: templateBody },
      { type: "send", text: "d" },
      { type: "send", text: TUI_KEYS.ESC },
      { type: "expect", text: templateName },
      { type: "send", text: "1" },
      { type: "expect", text: "▸ Tickets" },
      { type: "send", text: "q" },
    ]);

    const templates = await listTemplates(project.id);
    const updated = templates.find((template) => template.name === templateName);
    expect(updated?.is_default).toBe(true);
  }, 40_000);

  test("covers settings overlay open, section switching, and close", async () => {
    const { repo, project } = await createRepoWithProject("tui-feature-settings");

    run(repo, [
      { type: "expect", text: project.name },
      { type: "sleep", ms: 1000 },
      { type: "send", text: "S" },
      { type: "expect", text: "n new" },
      { type: "expect", text: "d default" },
      { type: "send", text: TUI_KEYS.TAB },
      { type: "expect", text: "n new" },
      { type: "expect", text: "x delete" },
      { type: "send", text: TUI_KEYS.SHIFT_TAB },
      { type: "expect", text: "d default" },
      { type: "send", text: TUI_KEYS.ESC },
      { type: "expect", text: project.name },
      { type: "send", text: "q" },
    ]);
  }, 35_000);
});
