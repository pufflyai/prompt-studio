import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

const writeExtensionFixture = (repoPath: string) => {
  mkdirSync(join(repoPath, ".pstdio", "extensions"), { recursive: true });
  cpSync(
    join(import.meta.dirname, "../../../../../../.pstdio/extensions/extension-lab"),
    join(repoPath, ".pstdio", "extensions", "extension-lab"),
    { recursive: true },
  );
};

const createProject = async (name: string) => {
  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json() as Promise<{ id: string }>;
};

const registerRepo = (projectId: string, repoPath: string) =>
  app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "repo", path: repoPath }),
  });

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-extension-template-registry-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("extension template registry lifecycle", () => {
  test("lists, disables, enables, copies, and edits extension defaults without mutating the source asset", async () => {
    const project = await createProject("Extension Template Registry");
    const repoPath = join(tempRoot, "extension-template-repo");
    writeExtensionFixture(repoPath);
    expect((await registerRepo(project.id, repoPath)).status).toBe(201);

    const defaultName = "project.extension-lab.labTicket";
    const encodedDefaultName = encodeURIComponent(defaultName);

    const listRes = await app.request(`/v1/projects/${project.id}/templates?type=ticket`);
    expect(listRes.status).toBe(200);
    const listed = (await listRes.json()) as Array<{ name: string; source_kind?: string; read_only?: boolean }>;
    expect(listed).toContainEqual(
      expect.objectContaining({
        name: defaultName,
        source_kind: "extension-default",
        read_only: true,
      }),
    );

    const defaultRes = await app.request(`/v1/projects/${project.id}/templates/${encodedDefaultName}`);
    expect(defaultRes.status).toBe(200);
    const defaultTemplate = (await defaultRes.json()) as { content: string };
    expect(defaultTemplate.content.length).toBeGreaterThan(0);

    const updateDefaultRes = await app.request(`/v1/projects/${project.id}/templates/${encodedDefaultName}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "# should not save" }),
    });
    expect(updateDefaultRes.status).toBe(400);

    expect(
      (
        await app.request(`/v1/projects/${project.id}/templates/${encodedDefaultName}/disable`, {
          method: "POST",
        })
      ).status,
    ).toBe(200);

    const disabledListRes = await app.request(`/v1/projects/${project.id}/templates?type=ticket`);
    const disabledList = (await disabledListRes.json()) as Array<{ name: string }>;
    expect(disabledList.some((template) => template.name === defaultName)).toBe(false);

    expect(
      (
        await app.request(`/v1/projects/${project.id}/templates/${encodedDefaultName}/enable`, {
          method: "POST",
        })
      ).status,
    ).toBe(200);

    const copyRes = await app.request(`/v1/projects/${project.id}/templates/${encodedDefaultName}/copy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "lab-ticket-copy", is_default: true }),
    });
    expect(copyRes.status).toBe(201);
    expect(await copyRes.json()).toMatchObject({
      name: "lab-ticket-copy",
      source_kind: "project",
      read_only: false,
      origin_extension_id: "project.extension-lab",
      origin_template_key: "labTicket",
      is_default: true,
    });

    expect(
      (
        await app.request(`/v1/projects/${project.id}/templates/lab-ticket-copy`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: "# Edited Variation" }),
        })
      ).status,
    ).toBe(200);

    const copiedRes = await app.request(`/v1/projects/${project.id}/templates/lab-ticket-copy`);
    const copiedTemplate = (await copiedRes.json()) as { content: string; read_only?: boolean };
    expect(copiedTemplate.read_only).toBe(false);
    expect(copiedTemplate.content).not.toBe(defaultTemplate.content);

    const defaultAfterCopyRes = await app.request(`/v1/projects/${project.id}/templates/${encodedDefaultName}`);
    const defaultAfterCopy = (await defaultAfterCopyRes.json()) as { content: string };
    expect(defaultAfterCopy.content).toBe(defaultTemplate.content);
  });
});
