import { expect, test } from "bun:test";
import type { CommandOutcome } from "../extensions";
import { createClient } from "./client";
import { PstdioApiError } from "./request";

test("command execution keeps legacy field access and complete rejection details", async () => {
  const outcome = {
    ok: false,
    status: "rejected",
    reason: "Changed",
    code: "stale_revision",
    data: { revision: 2 },
    cause: { source: "storage" },
  } satisfies CommandOutcome;
  const client = createClient({
    baseUrl: "http://host",
    fetch: (async () =>
      Response.json({
        commandId: "save",
        extensionId: "notes",
        outcome,
      })) as unknown as typeof fetch,
  });
  const response = await client.extensions.execute("save", { projectId: "project" });
  expect(response.outcome.value).toBeUndefined();
  expect(response.outcome.reason).toBe("Changed");
  expect(response.outcome).toEqual(outcome);
});

test("sends catalog and multipart installs through the same endpoint", async () => {
  const calls: Request[] = [];
  const client = createClient({
    baseUrl: "http://host",
    fetch: (async (url, init) => {
      calls.push(new Request(url, init));
      return Response.json({ source: {}, extension: {} }, { status: 201 });
    }) as typeof fetch,
  }).extensions;
  await client.install("project", { source: { kind: "catalog", name: "tool", ref: "main" }, force: true });
  expect(calls[0]!.url).toBe("http://host/v1/projects/project/extensions/install");
  expect(await calls[0]!.json()).toEqual({ source: { kind: "catalog", name: "tool", ref: "main" }, force: true });
  const upload = new FormData();
  upload.append("kind", "upload");
  upload.append("folderName", "tool");
  upload.append("files", new File(["{}"], "package.json"));
  await client.install("project", { upload });
  expect(calls[1]!.headers.get("content-type")).toContain("multipart/form-data");
  expect((await calls[1]!.formData()).get("kind")).toBe("upload");
});

test("preserves the host conflict code for replacement controls", async () => {
  const client = createClient({
    baseUrl: "http://host",
    fetch: (async () =>
      Response.json(
        { error: "Already installed", code: "extension_already_installed" },
        { status: 409 },
      )) as unknown as typeof fetch,
  }).extensions;
  try {
    await client.install("project", { source: { kind: "catalog", name: "tool" } });
    throw new Error("Expected a conflict");
  } catch (error) {
    expect(error).toBeInstanceOf(PstdioApiError);
    expect((error as PstdioApiError).code).toBe("extension_already_installed");
  }
});
