import { expect, test } from "bun:test";
import type { CommandOutcome } from "../extensions";
import { createClient } from "./client";
import { PstdioApiError } from "./request";

test("selects a saved connection sign-in while preserving ordinary disconnects", async () => {
  const calls: Request[] = [];
  const client = createClient({
    baseUrl: "http://host",
    fetch: (async (url, init) => {
      calls.push(new Request(url, init));
      return new Response(null, { status: 204 });
    }) as typeof fetch,
  }).extensions;
  const origin = "http://[::1]:1234";

  await client.deleteConnection("project", "example.tool", "connection/id");
  await client.deleteConnection("project", "example.tool", "connection/id", {
    credentialScope: "all-projects",
    origin,
    signInScope: "global",
  });

  expect(calls.map((request) => request.method)).toEqual(["DELETE", "DELETE"]);
  const [local, selected] = calls.map((request) => new URL(request.url));
  expect(local!.pathname).toBe("/v1/projects/project/extension-connections/example.tool/connection%2Fid");
  expect(local!.search).toBe("");
  expect(selected!.pathname).toEqual(local!.pathname);
  expect(Object.fromEntries(selected!.searchParams)).toEqual({
    credentialScope: "all-projects",
    origin,
    signInScope: "global",
  });
});

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
