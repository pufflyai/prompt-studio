import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import cmdShim from "cmd-shim";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { runPackagedAsync } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

interface NativeCall {
  pid: number;
  method: string;
  params: { config?: Record<string, unknown>; threadId?: string; serviceTier?: string };
}
setupPackagedSmokeTests();

test.each([false, true])(
  "packaged Codex sessions steer and stop independently (existing goal turn=%s)",
  async (existingGoalTurn) => {
    const root = mkdtempSync(join(tmpdir(), "packaged-shared-codex-"));
    let runtime: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
    const evidence = join(root, "calls.jsonl");
    try {
      const bin = join(root, "bin");
      mkdirSync(bin);
      const launcher = join(bin, "cli.ts");
      writeFileSync(
        launcher,
        `#!/usr/bin/env bun\nimport ${JSON.stringify(join(import.meta.dir, "packaged-codex.fixture.ts"))};\n`,
      );
      chmodSync(launcher, 0o755);
      if (process.platform === "win32") await cmdShim(launcher, join(bin, "codex"));
      else
        writeFileSync(
          join(bin, "codex"),
          `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(launcher)} "$@"\n`,
          { mode: 0o755 },
        );
      runtime = await startPackagedServe(root, {
        PATH: `${bin}${delimiter}${process.env.PATH}`,
        PSTDIO_CODEX_PEER_LOG: evidence,
        PSTDIO_CODEX_PEER_STEER_GOAL: existingGoalTurn ? "1" : "0",
        PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("harness-codex"),
      });
      const headers = { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" };
      const request = async (path: string, method = "GET", body?: unknown) => {
        const response = await fetch(`${runtime!.baseUrl}/v1${path}`, {
          method,
          headers,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const content = await response.text();
        if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${content}`);
        return JSON.parse(content);
      };
      const sessions: Array<{ id: string; project_id: string; agent_session_id: string | null }> = [];
      const listSessions = async (projectId: string, status?: string) =>
        JSON.parse(
          await runPackagedAsync(
            ["sessions", "list", "--project-id", projectId, "--json", ...(status ? ["--status", status] : [])],
            root,
            { PSTDIO_API_URL: runtime!.baseUrl, PSTDIO_API_TOKEN: runtime!.descriptor.token, PSTDIO_HOME: root },
          ),
        );
      for (const name of ["first", "second"]) {
        const folder = join(root, name);
        mkdirSync(folder);
        const project = await request("/projects", "POST", folderProjectInput({ name }, folder));
        expect(await listSessions(project.id)).toEqual([]);
        sessions.push(
          await request("/sessions", "POST", {
            project_id: project.id,
            title: name,
            prompt: name,
            agent: "pstdio.harness-codex.harness.codex",
            params: { service_tier: name === "first" ? "fast" : "default" },
          }),
        );
      }
      const calls = () =>
        existsSync(evidence)
          ? readFileSync(evidence, "utf8")
              .trim()
              .split("\n")
              .map((line) => JSON.parse(line) as NativeCall)
          : [];
      for (
        let attempt = 0;
        attempt < 100 && calls().filter((call) => call.method === "turn/start").length < 2;
        attempt++
      )
        await Bun.sleep(20);
      const starts = calls().filter((call) => call.method === "thread/start");
      expect(starts).toHaveLength(2);
      expect(new Set(starts.map((call) => call.pid)).size).toBe(1);
      expect(starts.map((call) => call.params.serviceTier)).toEqual(["fast", "default"]);
      expect(
        calls()
          .filter((call) => call.method === "turn/start")
          .map((call) => call.params.serviceTier),
      ).toEqual(["fast", "default"]);
      for (const session of sessions)
        expect(await listSessions(session.project_id, "in_progress")).toMatchObject([
          { id: session.id, title: expect.any(String), status: "in_progress", project_id: session.project_id },
        ]);
      for (const [index, start] of starts.entries())
        expect(start.params.config?.["shell_environment_policy.set"]).toMatchObject({
          PSTDIO_SESSION_ID: sessions[index].id,
          PSTDIO_PROJECT_ID: sessions[index].project_id,
        });
      const steeredSession = sessions[1];
      await request(`/sessions/${steeredSession.id}/follow-up`, "POST", { prompt: "Focus on the tests" });
      const queuePath = `/sessions/${steeredSession.id}/queued-follow-ups`;
      const queue = await request(queuePath);
      expect(queue.steeringAvailable).toBe(true);
      expect(queue.requests).toHaveLength(1);
      const queued = queue.requests[0];
      const delivery = await request(`${queuePath}/${queued.queuePosition}/steer`, "POST", {
        expectedRevision: queued.revision,
        expectedRunStartedAt: queue.activeRunStartedAt,
      });
      expect(delivery.status).toBe("accepted");
      expect((await request(queuePath)).requests).toHaveLength(0);
      const active = await request(`/sessions/${steeredSession.id}`);
      expect(active.status).toBe("in_progress");
      expect(active.last_request_started).toBe(queue.activeRunStartedAt);
      expect(calls().filter((call) => call.method === "turn/start")).toHaveLength(2);
      expect(calls().filter((call) => call.method === "turn/steer")).toHaveLength(1);
      await request(`/sessions/${sessions[0].id}/status`, "PATCH", { status: "cancelled" });
      expect(await listSessions(sessions[0].project_id, "in_progress")).toEqual([]);
      expect(await listSessions(sessions[0].project_id, "cancelled")).toMatchObject([
        { id: sessions[0].id, status: "cancelled" },
      ]);
      expect((await request(`/sessions/${sessions[1].id}`)).status).toBe("in_progress");
      expect(calls().filter((call) => call.method === "turn/interrupt")).toHaveLength(1);
      const exited = new Promise<number | null>((resolve) => runtime!.child.once("exit", resolve));
      const shutdown = await fetch(`${runtime.baseUrl}/runtime/shutdown`, {
        method: "POST",
        headers,
        body: JSON.stringify({ instanceId: runtime.descriptor.instanceId, force: true }),
      });
      expect(shutdown.status).toBe(202);
      expect(await exited).toBe(0);
      expect(calls().filter((call) => call.method === "turn/interrupt")).toHaveLength(2);
      if (existingGoalTurn) expect(calls().filter((call) => call.method === "thread/goal/set")).toHaveLength(2);
    } finally {
      if (runtime) await stopProcess(runtime.child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
