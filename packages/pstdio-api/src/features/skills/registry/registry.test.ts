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
  skillAssetPath: string;
};

const ORIGINAL_HOME = process.env.PSTDIO_HOME;

const writeFixtureExtension = (pstdioHome: string) => {
  const extDir = join(pstdioHome, "extensions", "extension-lab");
  const skillsDir = join(extDir, "skills", "lab-skill");
  mkdirSync(skillsDir, { recursive: true });

  const skillAssetPath = join(skillsDir, "SKILL.md");
  writeFileSync(skillAssetPath, "# Lab Skill\nOriginal extension skill body.\n");

  const extensionTs = `
const packageAsset = (path, baseUrl) => ({ kind: "package-asset", path, baseUrl });
export default {
  id: "pstdio.extension-lab",
  namespace: "lab",
  name: "Extension Lab",
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
  return { skillAssetPath };
};

const createHarness = async (): Promise<Harness> => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-skill-registry-test-"));
  const pstdioHome = join(tempRoot, "pstdio");
  mkdirSync(pstdioHome, { recursive: true });
  process.env.PSTDIO_HOME = pstdioHome;

  const { skillAssetPath } = writeFixtureExtension(pstdioHome);

  const { app, close } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: join(tempRoot, "files"),
  });

  return { app, close, tempRoot, pstdioHome, skillAssetPath };
};

const createProject = async (app: OpenAPIHono<AppBindings>) => {
  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Skill Registry Test" }),
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

type SkillRow = {
  source_kind: "project" | "extension-default";
  read_only: boolean;
  name: string;
  asset_kind?: string;
  extension_id?: string | null;
  skill_key?: string | null;
  origin_extension_id?: string | null;
  origin_skill_key?: string | null;
};

const findExtensionDefault = (list: SkillRow[], name: string) =>
  list.find((item) => item.source_kind === "extension-default" && item.name === name);
const findProjectSkill = (list: SkillRow[], name: string) =>
  list.find((item) => item.source_kind === "project" && item.name === name);

describe("skill registry vertical slice", () => {
  test("default-to-variation lifecycle preserves the extension skill asset", async () => {
    const { app, skillAssetPath } = harness!;
    const projectId = await createProject(app);

    const list = (await (await app.request(`/v1/projects/${projectId}/skills`)).json()) as SkillRow[];
    const extensionItem = findExtensionDefault(list, "lab.lab");
    expect(extensionItem).toBeDefined();
    expect(extensionItem!.read_only).toBe(true);
    expect(extensionItem!.asset_kind).toBe("directory");
    expect(extensionItem!.extension_id).toBe("pstdio.extension-lab");
    expect(extensionItem!.skill_key).toBe("lab");

    const disableRes = await app.request(
      `/v1/projects/${projectId}/skills/extension/pstdio.extension-lab/lab/preference`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      },
    );
    expect(disableRes.status).toBe(200);

    const afterDisable = (await (await app.request(`/v1/projects/${projectId}/skills`)).json()) as SkillRow[];
    expect(findExtensionDefault(afterDisable, "lab.lab")).toBeUndefined();

    const enableRes = await app.request(
      `/v1/projects/${projectId}/skills/extension/pstdio.extension-lab/lab/preference`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      },
    );
    expect(enableRes.status).toBe(200);

    // Reading an extension default skill via the namespaced name surfaces files inline.
    const getDefaultRes = await app.request(`/v1/projects/${projectId}/skills/lab.lab`);
    expect(getDefaultRes.status).toBe(200);
    const fetchedDefault = await getDefaultRes.json();
    expect(fetchedDefault.source_kind).toBe("extension-default");
    expect(fetchedDefault.read_only).toBe(true);
    expect(fetchedDefault.files).toHaveLength(1);
    expect(fetchedDefault.files[0].content).toContain("Original extension skill");

    const copyRes = await app.request(`/v1/projects/${projectId}/skills/extension/pstdio.extension-lab/lab/copy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "lab-skill-copy" }),
    });
    expect(copyRes.status).toBe(201);
    const copied = await copyRes.json();
    expect(copied.name).toBe("lab-skill-copy");
    expect(copied.source_kind).toBe("project");
    expect(copied.read_only).toBe(false);
    expect(copied.origin_extension_id).toBe("pstdio.extension-lab");
    expect(copied.origin_skill_key).toBe("lab");
    expect(copied.files).toHaveLength(1);

    // Project copy is stored independently; the packaged extension asset must stay intact.
    const onDisk = readFileSync(skillAssetPath, "utf8");
    expect(onDisk).toContain("Original extension skill");

    const finalList = (await (await app.request(`/v1/projects/${projectId}/skills`)).json()) as SkillRow[];
    expect(findExtensionDefault(finalList, "lab.lab")).toBeDefined();
    const projectItem = findProjectSkill(finalList, "lab-skill-copy");
    expect(projectItem).toBeDefined();
    expect(projectItem!.origin_extension_id).toBe("pstdio.extension-lab");
    expect(projectItem!.origin_skill_key).toBe("lab");
  });
});
