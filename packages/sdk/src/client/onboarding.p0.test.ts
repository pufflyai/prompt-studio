import { expect, test } from "bun:test";
import { createClient } from "./client";

test("reports host installations and targets setup choices to their project", async () => {
  const paths: string[] = [];
  const state = { completed: false, hidden: false, harnesses: null, workAreas: null };
  const info = { state, platform: "linux", detectedHarnesses: [], installedExtensions: ["pstdio.harness-codex"] };
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      paths.push(new URL(request.url).pathname + new URL(request.url).search);
      return Response.json(request.method === "GET" ? info : state);
    },
  });
  try {
    const setup = createClient({ baseUrl: server.url.origin }).onboarding;
    expect(await setup.read()).toEqual(info);
    await setup.update({ step: "harnesses", harnesses: ["codex"] }, "project-1");
    await setup.update({ step: "visibility", hidden: true });
    expect(paths).toEqual(["/v1/onboarding", "/v1/onboarding?project_id=project-1", "/v1/onboarding"]);
  } finally {
    server.stop(true);
  }
});
