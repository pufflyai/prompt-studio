import { expect, test } from "bun:test";
import type { Api } from "./connection";
import { kitoStorage, kitoWorkflowPath, openKitoPreview } from "./kito-workflow";

const runId = "4feb9929-01f1-4e3e-ac7e-18ee36c7d501";
const signed = "https://storage.googleapis.com/bucket/object?signature=example";

test("Kito signs a source upload and a log read through the controller connection", async () => {
  const controllerCalls: Parameters<Api>[0][] = [];
  const api: Api = async <T>(input: Parameters<Api>[0]) => {
    controllerCalls.push(input);
    return { url: signed } as T;
  };
  const storageCalls: [string, string][] = [];
  const request = Object.assign(
    async (url: string | URL | Request, options?: RequestInit) => {
      storageCalls.push([String(url), options?.method ?? "GET"]);
      expect(options?.headers).toBeUndefined();
      return new Response(options?.method === "PUT" ? null : "test log");
    },
    { preconnect: fetch.preconnect },
  );
  const storage = kitoStorage(api, request);
  await storage.upload(`sources/${runId}.tar.gz`, new Blob(["archive"]));
  const log = await storage.download(`logs/${runId}.log`);

  expect(new TextDecoder().decode(log ?? undefined)).toBe("test log");
  expect(controllerCalls).toMatchObject([
    { path: `${kitoWorkflowPath}/storage/urls`, body: { action: "upload-source", runId, seconds: 300 } },
    { path: `${kitoWorkflowPath}/storage/urls`, body: { action: "read-log", runId, seconds: 300 } },
  ]);
  expect(storageCalls).toEqual([
    [signed, "PUT"],
    [signed, "GET"],
  ]);
});

test("Kito opens previews through the controller connection", async () => {
  const preview = {
    workspaceId: runId,
    url: "https://preview.example.test/",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  const api: Api = async <T>(input: Parameters<Api>[0]) => {
    expect(input.method).toBe("POST");
    expect(input.path).toBe(`${kitoWorkflowPath}/previews/${runId}`);
    return preview as T;
  };
  expect(await openKitoPreview(api, runId)).toEqual(preview);
});
