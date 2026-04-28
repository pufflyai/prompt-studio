import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../../app";

const writeFakeHarnessExtension = (repoRoot: string) => {
  const extensionDir = join(repoRoot, ".pstdio", "extensions", "pstdio.harness.fake");
  mkdirSync(extensionDir, { recursive: true });
  writeFileSync(
    join(extensionDir, "extension.ts"),
    `const exited = Promise.resolve({ code: 0, signal: null });

const pushTextPair = (eventStore, sessionId, prompt, offset) => {
  eventStore?.push({
    op: "add",
    path: \`/messages/\${offset}\`,
    value: { id: \`\${sessionId}-\${offset}\`, role: "user", parts: [{ type: "text", text: prompt }], index: offset },
  });
  eventStore?.push({
    op: "add",
    path: \`/messages/\${offset + 1}\`,
    value: {
      id: \`\${sessionId}-\${offset + 1}\`,
      role: "assistant",
      parts: [{ type: "text", text: \`done: \${prompt}\` }],
      index: offset + 1,
    },
  });
};

const createProcess = (sessionId) => ({
  sessionId,
  stdin: { write() {}, end() {} },
  kill() {},
  onExit: exited,
});

export default {
  id: "pstdio.harness.fake",
  name: "Fake Harness",
  harnesses: {
    fake: {
      id: "pstdio.harness.fake",
      label: "Fake Harness",
      async detect() {
        return { available: true };
      },
      listModels() {
        return [{ id: "fake" }];
      },
      async startSession(_ctx, input) {
        pushTextPair(input.eventStore, "fake-extension-run-1", input.prompt, 0);
        return {
          sessionId: "fake-extension-run-1",
          process: createProcess("fake-extension-run-1"),
        };
      },
      async resumeSession(_ctx, input, eventStore) {
        pushTextPair(eventStore, input.sessionId, input.prompt, input.messageOffset ?? 0);
        return {
          process: createProcess(input.sessionId),
        };
      },
      async getMessages() {
        return [];
      },
      async start(_ctx, input) {
        return { runId: input.sessionId, onExit: exited };
      },
    },
  },
};
`,
  );
};

const waitForSessionStatus = async (
  app: Awaited<ReturnType<typeof createApp>>["app"],
  sessionId: string,
  expectedStatus: string,
) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await app.request(`/v1/sessions/${sessionId}`);
    expect(response.status).toBe(200);
    const session = await response.json();
    if (session.status === expectedStatus) return session;
    await Bun.sleep(20);
  }

  throw new Error(`Session ${sessionId} did not reach status ${expectedStatus}`);
};

describe("extension-backed harness session ingress", () => {
  test("starts and sends without the legacy agent registry", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-extension-harness-session-test-"));
    const repoRoot = join(tempRoot, "repo");
    mkdirSync(repoRoot, { recursive: true });
    writeFakeHarnessExtension(repoRoot);

    const handle = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage"),
      filesRoot: "",
    });

    try {
      const projectResponse = await handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Extension Harness Project", agents: ["pstdio.harness.fake"] }),
      });
      expect(projectResponse.status).toBe(201);
      const project = await projectResponse.json();
      expect(typeof project.id).toBe("string");

      const repoResponse = await handle.app.request(`/v1/projects/${project.id}/repos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "repo", path: repoRoot }),
      });
      expect(repoResponse.status).toBe(201);
      const linkedRepos = await handle.deps.repoService.listByProject(project.id);
      expect(linkedRepos).toHaveLength(1);
      expect(linkedRepos[0]?.path).toBe(repoRoot);
      expect(existsSync(join(repoRoot, ".pstdio", "extensions", "pstdio.harness.fake", "extension.ts"))).toBe(true);

      const modelsResponse = await handle.app.request(
        `/v1/harnesses/pstdio.harness.fake/models?project_id=${project.id}`,
      );
      expect(modelsResponse.status).toBe(200);
      expect(await modelsResponse.json()).toEqual([{ id: "fake" }]);
      const providerIds = (await handle.deps.harnessProviderService.list(project.id)).map(
        ({ provider }) => provider.id,
      );
      expect(providerIds).toContain("pstdio.harness.fake");

      const startResponse = await handle.app.request("/v1/harnesses/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Extension harness start",
          prompt: "start",
          harness: "pstdio.harness.fake",
        }),
      });
      if (startResponse.status !== 201) throw new Error(await startResponse.text());
      expect(startResponse.status).toBe(201);
      const session = await startResponse.json();
      expect(session.agent).toBe("pstdio.harness.fake");
      await waitForSessionStatus(handle.app, session.id, "completed");

      const sendResponse = await handle.app.request(`/v1/harnesses/sessions/${session.id}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "follow-up", harness: "pstdio.harness.fake" }),
      });
      expect(sendResponse.status).toBe(200);
      expect(await sendResponse.json()).toMatchObject({ id: session.id, agent: "pstdio.harness.fake" });
      await waitForSessionStatus(handle.app, session.id, "completed");
    } finally {
      await handle.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
