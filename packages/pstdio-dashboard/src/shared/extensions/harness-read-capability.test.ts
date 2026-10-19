import { expect, test } from "bun:test";
import { createClient } from "@pstdio/sdk/client";
import { createHarnessReadCapability } from "./harness-read-capability";

test("embedded harness controls read the selected project's models and model-specific options", async () => {
  const paths: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      paths.push(url.pathname + url.search);
      if (url.pathname === "/v1/projects/project-one")
        return Response.json({ default_agent_id: "codex", default_agent_model: "small" });
      if (url.pathname === "/v1/agents/info")
        return Response.json([
          { id: "codex", name: "Codex", supportsModels: true, availability: { type: "INSTALLED" } },
        ]);
      if (url.pathname === "/v1/agents/codex/models")
        return Response.json([{ id: "small" }, { id: "large", isDefault: true }]);
      if (url.pathname.endsWith("/params"))
        return Response.json({
          schema: { effort: { type: "select", options: [{ label: "High", value: "high" }] } },
          defaults: { effort: "high" },
        });
      return new Response("Unknown endpoint", { status: 404 });
    },
  });
  try {
    const read = createHarnessReadCapability("project-one", createClient({ baseUrl: server.url.href }));
    expect(await read({})).toMatchObject({ selection: { harnessId: "codex", model: "small" } });
    expect(await read({ harnessId: "codex", model: "large" })).toMatchObject({
      selection: { harnessId: "codex", model: "large" },
      defaults: { effort: "high" },
    });
    expect(paths).toContain("/v1/agents/info?projectId=project-one");
    expect(paths).toContain("/v1/agents/codex/models?projectId=project-one");
    expect(paths).toContain("/v1/projects/project-one/harnesses/codex/params?model=large");
  } finally {
    server.stop(true);
  }
});
