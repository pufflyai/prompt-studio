import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { cleanupDirs, createGitRepo, runPstdio } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi();
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

const dirs: string[] = [];

afterEach(() => {
  cleanupDirs(dirs);
});

const run = (args: string, cwd: string) => runPstdio(args, cwd, { PSTDIO_API_URL: api.url });

const createInitializedRepo = (name: string) => {
  const repo = createGitRepo();
  dirs.push(repo);
  run(`projects create ${name}`, repo);
  return repo;
};

const getProjectId = async (name: string) => {
  const res = await fetch(`${api.url}/v1/projects`);
  const projects = (await res.json()) as { id: string; name: string }[];
  const project = projects.find((p) => p.name === name);
  if (!project) throw new Error(`Project not found: ${name}`);
  return project.id;
};

describe("ticket creation via API with content field", () => {
  test(
    "sets display_title and file_id when content is provided",
    async () => {
      createInitializedRepo("tk-api-content");
      const projectId = await getProjectId("tk-api-content");

      const res = await fetch(`${api.url}/v1/tickets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          content: "# Build login page\n\nImplement OAuth flow.",
        }),
      });

      expect(res.status).toBe(201);
      const ticket = (await res.json()) as {
        id: string;
        shorthand: string;
        display_title: string | null;
        file_id: string | null;
      };

      expect(ticket.display_title).toBe("Build login page");
      expect(ticket.file_id).not.toBeNull();
    },
    TEST_TIMEOUT,
  );

  test(
    "ticket created with content is visible via CLI list with display_title",
    async () => {
      const repo = createInitializedRepo("tk-api-visible");
      const projectId = await getProjectId("tk-api-visible");

      await fetch(`${api.url}/v1/tickets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          content: "# Visible ticket\n\nDetails.",
        }),
      });

      const output = run("tickets list", repo);
      expect(output).toContain("Visible ticket");
    },
    TEST_TIMEOUT,
  );

  test(
    "ticket file content is downloadable after creation with content",
    async () => {
      createInitializedRepo("tk-api-download");
      const projectId = await getProjectId("tk-api-download");

      const content = "# Downloadable ticket\n\nWith body.";
      const res = await fetch(`${api.url}/v1/tickets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: projectId, content }),
      });

      const ticket = (await res.json()) as { id: string; file_id: string };
      const fileRes = await fetch(`${api.url}/v1/tickets/${ticket.id}/files/${ticket.file_id}/content`);
      expect(fileRes.status).toBe(200);
      expect(await fileRes.text()).toBe(content);
    },
    TEST_TIMEOUT,
  );
});
