import { afterEach, expect, test } from "bun:test";
import { createApi } from "./pr-risk-labels";

const servers: ReturnType<typeof Bun.serve>[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
});

const versionApi = (source: string) => {
  const requests: URL[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      requests.push(new URL(request.url));
      return Response.json({ encoding: "base64", content: Buffer.from(source).toString("base64") });
    },
  });
  servers.push(server);
  return {
    requests,
    api: createApi({
      apiUrl: server.url.origin,
      repository: "owner/repo",
      token: "fixture-token",
      pullNumber: 1,
      runUrl: "https://example.test/run",
    }),
  };
};

test("reads the declared API version from the captured revision without executing source", async () => {
  const { api, requests } = versionApi(
    'throw new Error("Do not execute PR source");\nexport const EXTENSION_API_VERSION = "1.0.0-alpha.11";',
  );
  expect(await api.readExtensionApiVersion("captured-head")).toBe("1.0.0-alpha.11");
  expect(requests[0].searchParams.get("ref")).toBe("captured-head");
});

test("does not infer an API version from a commented declaration", async () => {
  const { api } = versionApi('// export const EXTENSION_API_VERSION = "1.0.0-alpha.11";');
  await expect(api.readExtensionApiVersion("captured-head")).rejects.toThrow("Could not parse");
});
