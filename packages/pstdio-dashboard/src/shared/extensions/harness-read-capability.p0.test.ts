import { afterAll, beforeAll, expect, test } from "bun:test";
import { createClient } from "@pstdio/sdk/client";
import {
  createMemoryRecentHarnessStorage,
  saveRecentHarnessSelection,
} from "@/shared/command-params/recent-harness-param";
import { createHarnessReadCapability } from "./harness-read-capability";

const paths: string[] = [];
let server: ReturnType<typeof Bun.serve>;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      paths.push(url.pathname + url.search);
      if (url.pathname === "/v1/projects/project-one")
        return Response.json({ default_agent_id: "codex", default_agent_model: "small" });
      if (url.pathname === "/v1/agents/info")
        return Response.json([
          { id: "codex", name: "Codex", supportsModels: true, availability: { type: "INSTALLED" } },
          { id: "claude", name: "Claude", supportsModels: true, availability: { type: "INSTALLED" } },
        ]);
      if (url.pathname === "/v1/agents/codex/models")
        return Response.json([{ id: "small" }, { id: "large", isDefault: true }]);
      if (url.pathname === "/v1/agents/claude/models") return Response.json([{ id: "opus", isDefault: true }]);
      if (url.pathname.endsWith("/params")) {
        const model = url.searchParams.get("model");
        return Response.json({
          schema: { effort: { type: "select", options: [{ label: model ?? "harness", value: "high" }] } },
          defaults: { effort: "high" },
        });
      }
      return new Response("Unknown endpoint", { status: 404 });
    },
  });
});

afterAll(() => server.stop(true));

const createRead = (storage = createMemoryRecentHarnessStorage()) =>
  createHarnessReadCapability("project-one", { client: createClient({ baseUrl: server.url.href }), storage });

test("embedded harness controls read options for the model they select", async () => {
  const read = createRead();
  expect(await read({})).toMatchObject({
    selection: { harnessId: "codex", model: "small" },
    schema: { effort: { options: [{ label: "small" }] } },
  });
  expect(await read({ harnessId: "codex", model: "large" })).toMatchObject({
    selection: { harnessId: "codex", model: "large" },
    schema: { effort: { options: [{ label: "large" }] } },
  });
  expect(await read({ harnessId: "codex", model: "retired" })).toMatchObject({
    selection: { harnessId: "codex", model: "small" },
    schema: { effort: { options: [{ label: "small" }] } },
  });
  expect(paths).toContain("/v1/agents/info?projectId=project-one");
  expect(paths).toContain("/v1/agents/codex/models?projectId=project-one");
});

test("embedded harness controls open on the project's last-used harness like the native field", async () => {
  const storage = createMemoryRecentHarnessStorage();
  saveRecentHarnessSelection("project-one", { harnessId: "claude", model: "opus" }, storage);
  expect(await createRead(storage)({})).toMatchObject({ selection: { harnessId: "claude", model: "opus" } });
});
