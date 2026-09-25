import { expect } from "bun:test";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";

export const expectPackagedFolderOwnership = async (baseUrl: string, headers: HeadersInit, root: string) => {
  const folder = join(root, "another-host-folder");
  mkdirSync(join(folder, ".pstdio"), { recursive: true });
  const path = join(folder, ".pstdio/config.json");
  const original = JSON.stringify({ project_id: "another-host-project", workspace_id: "another-host-workspace" });
  writeFileSync(path, original);
  const create = await fetch(`${baseUrl}/v1/projects`, {
    method: "POST",
    headers: { ...Object.fromEntries(new Headers(headers)), "content-type": "application/json" },
    body: JSON.stringify(folderProjectInput({}, folder)),
  });
  expect(create.status).toBe(201);
  const project = (await create.json()) as { id: string };
  const response = await fetch(`${baseUrl}/v1/workspaces?project_id=${project.id}`, { headers });
  const [workspace] = (await response.json()) as { setup_error: string | null }[];
  expect(workspace!.setup_error).toBeTruthy();
  expect(readFileSync(path, "utf8")).toBe(original);
  expect((await fetch(`${baseUrl}/v1/projects/${project.id}`, { method: "DELETE", headers })).status).toBe(204);
  expect(readFileSync(path, "utf8")).toBe(original);
  await expectPackagedMetadataSymlink(baseUrl, headers, root);
};

const expectPackagedMetadataSymlink = async (baseUrl: string, headers: HeadersInit, root: string) => {
  const folder = join(root, "linked-metadata-folder");
  mkdirSync(join(folder, ".pstdio"), { recursive: true });
  const target = join(root, "outside-gitignore");
  writeFileSync(target, "preserve user content\n");
  symlinkSync(target, join(folder, ".pstdio", ".gitignore"), "file");
  const create = await fetch(`${baseUrl}/v1/projects`, {
    method: "POST",
    headers: { ...Object.fromEntries(new Headers(headers)), "content-type": "application/json" },
    body: JSON.stringify(folderProjectInput({}, folder)),
  });
  expect(create.status).toBe(201);
  const project = (await create.json()) as { id: string };
  const response = await fetch(`${baseUrl}/v1/workspaces?project_id=${project.id}`, { headers });
  const [workspace] = (await response.json()) as { setup_error: string | null }[];
  expect(workspace!.setup_error).toContain("symlink");
  expect(readFileSync(target, "utf8")).toBe("preserve user content\n");
  expect((await fetch(`${baseUrl}/v1/projects/${project.id}`, { method: "DELETE", headers })).status).toBe(204);
  expect(readFileSync(target, "utf8")).toBe("preserve user content\n");
};
