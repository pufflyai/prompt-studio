import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

type Harness = {
  app: OpenAPIHono<AppBindings>;
  close: () => Promise<void>;
  tempRoot: string;
  pstdioHome: string;
  templateAssetPath: string;
};

const ORIGINAL_HOME = process.env.PSTDIO_HOME;

const writeFixtureExtension = (pstdioHome: string) => {
  const extDir = join(pstdioHome, "extensions", "extension-lab");
  const templatesDir = join(extDir, "templates");
  const skillsDir = join(extDir, "skills", "lab-skill");
  mkdirSync(templatesDir, { recursive: true });
  mkdirSync(skillsDir, { recursive: true });

  const templateAssetPath = join(templatesDir, "lab-ticket.md");
  writeFileSync(templateAssetPath, "# Lab Ticket\nOriginal extension template body.\n");
  writeFileSync(join(skillsDir, "SKILL.md"), "# Lab Skill\nOriginal extension skill body.\n");

  const extensionTs = `
const packageAsset = (path, baseUrl) => ({ kind: "package-asset", path, baseUrl });
export default {
  id: "pstdio.extension-lab",
  namespace: "lab",
  name: "Extension Lab",
  templates: {
    labTicket: {
      title: "Lab Ticket",
      type: "ticket",
      source: packageAsset("./templates/lab-ticket.md", import.meta.url),
    },
  },
  skills: {
    lab: {
      title: "Lab Skill",
      description: "Lab skill default.",
      source: packageAsset("./skills/lab-skill", import.meta.url),
    },
  },
};
`;
  writeFileSync(join(extDir, "extension.ts"), extensionTs);
  return { templateAssetPath };
};

const createHarness = async (): Promise<Harness> => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-registry-test-"));
  const pstdioHome = join(tempRoot, "pstdio");
  mkdirSync(pstdioHome, { recursive: true });
  process.env.PSTDIO_HOME = pstdioHome;

  const { templateAssetPath } = writeFixtureExtension(pstdioHome);

  const { app, close } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: join(tempRoot, "files"),
  });

  return { app, close, tempRoot, pstdioHome, templateAssetPath };
};

const createProject = async (app: OpenAPIHono<AppBindings>) => {
  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Registry Test" }),
  });
  expect(res.status).toBe(201);
  return (await res.json()).id as string;
};

let harness: Harness | undefined;

beforeEach(async () => {
  harness = await createHarness();
});

afterEach(async () => {
  await harness?.close();
  if (harness) rmSync(harness.tempRoot, { recursive: true, force: true });
  harness = undefined;
  if (ORIGINAL_HOME === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = ORIGINAL_HOME;
});

type TemplateRow = {
  source_kind: "project" | "extension-default";
  read_only: boolean;
  name: string;
  template_type: string;
  extension_id?: string | null;
  template_key?: string | null;
  origin_extension_id?: string | null;
  origin_template_key?: string | null;
};

const findExtensionDefault = (list: TemplateRow[], name: string) =>
  list.find((item) => item.source_kind === "extension-default" && item.name === name);
const findProjectTemplate = (list: TemplateRow[], name: string) =>
  list.find((item) => item.source_kind === "project" && item.name === name);

describe("template registry vertical slice", () => {
  test("default-to-variation lifecycle preserves the extension asset", async () => {
    const { app, templateAssetPath } = harness!;
    const projectId = await createProject(app);

    // 1. Extension default appears in the merged template list as read-only.
    const listRes = await app.request(`/v1/projects/${projectId}/templates`);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as TemplateRow[];
    const extensionItem = findExtensionDefault(list, "lab.labTicket");
    expect(extensionItem).toBeDefined();
    expect(extensionItem!.read_only).toBe(true);
    expect(extensionItem!.template_type).toBe("ticket");
    expect(extensionItem!.extension_id).toBe("pstdio.extension-lab");
    expect(extensionItem!.template_key).toBe("labTicket");

    // 2. Disable the default — list omits it.
    const disableRes = await app.request(
      `/v1/projects/${projectId}/templates/extension/pstdio.extension-lab/labTicket/preference`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      },
    );
    expect(disableRes.status).toBe(200);

    const afterDisable = (await (await app.request(`/v1/projects/${projectId}/templates`)).json()) as TemplateRow[];
    expect(findExtensionDefault(afterDisable, "lab.labTicket")).toBeUndefined();

    // 3. Re-enable the default — appears again.
    const enableRes = await app.request(
      `/v1/projects/${projectId}/templates/extension/pstdio.extension-lab/labTicket/preference`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      },
    );
    expect(enableRes.status).toBe(200);

    const afterEnable = (await (await app.request(`/v1/projects/${projectId}/templates`)).json()) as TemplateRow[];
    expect(findExtensionDefault(afterEnable, "lab.labTicket")).toBeDefined();

    // 4. Read extension default content via the namespaced GET endpoint.
    const contentRes = await app.request(`/v1/projects/${projectId}/templates/lab.labTicket`);
    expect(contentRes.status).toBe(200);
    const content = await contentRes.json();
    expect(content.source_kind).toBe("extension-default");
    expect(content.read_only).toBe(true);
    expect(content.content).toContain("Original extension template");

    // 5. Mutating an extension default fails with 403.
    const editDefaultRes = await app.request(`/v1/projects/${projectId}/templates/lab.labTicket`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "# nope\n" }),
    });
    expect(editDefaultRes.status).toBe(403);

    const deleteDefaultRes = await app.request(`/v1/projects/${projectId}/templates/lab.labTicket`, {
      method: "DELETE",
    });
    expect(deleteDefaultRes.status).toBe(403);

    // 6. Copy default to project-owned variation.
    const copyRes = await app.request(
      `/v1/projects/${projectId}/templates/extension/pstdio.extension-lab/labTicket/copy`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "lab-ticket-copy" }),
      },
    );
    expect(copyRes.status).toBe(201);
    const copied = await copyRes.json();
    expect(copied.name).toBe("lab-ticket-copy");
    expect(copied.template_type).toBe("ticket");
    expect(copied.source_kind).toBe("project");
    expect(copied.read_only).toBe(false);
    expect(copied.origin_extension_id).toBe("pstdio.extension-lab");
    expect(copied.origin_template_key).toBe("labTicket");

    // 7. Edit the project copy via the same endpoint shape the dashboard already uses.
    const editRes = await app.request(`/v1/projects/${projectId}/templates/lab-ticket-copy`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "# Edited copy\n" }),
    });
    expect(editRes.status).toBe(200);

    const fetched = await (await app.request(`/v1/projects/${projectId}/templates/lab-ticket-copy`)).json();
    expect(fetched.content).toContain("Edited copy");
    expect(fetched.read_only).toBe(false);

    // 8. Extension source asset must remain unchanged.
    const onDisk = readFileSync(templateAssetPath, "utf8");
    expect(onDisk).toContain("Original extension template");
    expect(onDisk).not.toContain("Edited copy");

    // 9. Final list shows both extension default and the project copy with origin metadata.
    const finalList = (await (await app.request(`/v1/projects/${projectId}/templates`)).json()) as TemplateRow[];
    expect(findExtensionDefault(finalList, "lab.labTicket")).toBeDefined();
    const projectItem = findProjectTemplate(finalList, "lab-ticket-copy");
    expect(projectItem).toBeDefined();
    expect(projectItem!.origin_extension_id).toBe("pstdio.extension-lab");
    expect(projectItem!.origin_template_key).toBe("labTicket");
  });

  test("rejects copying a non-existent extension template", async () => {
    const { app } = harness!;
    const projectId = await createProject(app);
    const res = await app.request(`/v1/projects/${projectId}/templates/extension/missing/missing/copy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });

  test("sourceKind=project filter returns only editable templates", async () => {
    const { app } = harness!;
    const projectId = await createProject(app);

    const all = (await (await app.request(`/v1/projects/${projectId}/templates`)).json()) as TemplateRow[];
    expect(all.some((item) => item.source_kind === "extension-default")).toBe(true);

    const projectOnly = (await (
      await app.request(`/v1/projects/${projectId}/templates?sourceKind=project`)
    ).json()) as TemplateRow[];
    expect(projectOnly.every((item) => item.source_kind === "project")).toBe(true);
  });
});
