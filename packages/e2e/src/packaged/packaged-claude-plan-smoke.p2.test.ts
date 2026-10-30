import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

setupPackagedSmokeTests();

test.each([true, false])("packaged Claude plan review requires a visible preview (%s)", async (withPlan) => {
  const root = mkdtempSync(join(tmpdir(), "packaged-claude-plan-"));
  let child: ChildProcess | undefined;
  try {
    const source = join(root, "claude-plan-smoke");
    mkdirSync(source);
    const harnessRoot = join(import.meta.dir, "../../../../extensions/harness-claude-code");
    cpSync(join(harnessRoot, "src"), join(source, "src"), { recursive: true });
    cpSync(join(harnessRoot, "src/mocks/controlled-child.ts"), join(source, "src/controlled-child.ts"));
    const manifest = await Bun.file(join(harnessRoot, "package.json")).json();
    writeFileSync(
      join(source, "package.json"),
      JSON.stringify({
        name: "claude-plan-smoke",
        publisher: "test",
        version: "1.0.0",
        type: "module",
        main: "./extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        dependencies: { "@pstdio/sdk": manifest.dependencies["@pstdio/sdk"] },
      }),
    );
    writeFileSync(
      join(source, "extension.ts"),
      `
      import { startClaudeCodeSession } from "./src/spawn";
      import { controlledChild } from "./src/controlled-child";
      export default { harnesses: [{
        id: "worker", ref: { kind: "harness", id: "worker" }, label: "Claude plan", capabilities: () => [],
        async start(_ctx, input) {
          const fixture = controlledChild();
          const pending = startClaudeCodeSession(input, { spawnProcess: () => fixture.child });
          fixture.emit({ type: "system", subtype: "init", session_id: "native-plan" });
          const session = await pending;
          const tool = { type: "tool_use", id: "plan-tool", name: "ExitPlanMode", input: {} };
          fixture.emit({ type: "assistant", message: { role: "assistant", content: [tool] } });
          fixture.emit({ type: "control_request", request_id: "plan", request: { subtype: "can_use_tool", tool_name: "ExitPlanMode", input: input.prompt === "Missing plan" ? {} : { plan: "# Greeting plan\\n\\nAdd a greeting and run tests." }, tool_use_id: tool.id } });
          const timer = setInterval(() => {
            const reply = fixture.written().find(item => item.type === "control_response");
            if (!reply) return;
            clearInterval(timer);
            const approved = reply.response.response.behavior === "allow";
            fixture.emit({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: tool.id, content: approved ? "Plan approved." : "Plan needs changes.", is_error: !approved }] } });
            fixture.emit({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: approved ? "Implementing the greeting." : "Revising the plan." }] } });
            fixture.emit({ type: "result", usage: {} });
            fixture.child.exit();
          }, 10);
          return { ...session, stop() { clearInterval(timer); fixture.child.exit(); } };
        },
        resume() { throw new Error("Approval must answer the live process"); },
        getMessages() { return []; },
        recoverMessages(_ctx, input) { return { kind: "recovered", messages: input.knownMessages }; }
      }] };
    `,
    );
    const started = await startPackagedServe(root, {
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "claude-plan-smoke" }]),
    });
    child = started.child;
    const request = async (path: string, method = "GET", body?: unknown) => {
      const response = await fetch(`${started.baseUrl}/v1${path}`, {
        method,
        headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
      return response.json();
    };
    const folder = join(root, "project");
    mkdirSync(folder);
    const project = await request("/projects", "POST", folderProjectInput({ name: "Claude plan" }, folder));
    const session = await request("/sessions", "POST", {
      project_id: project.id,
      title: "Claude plan review",
      prompt: withPlan ? "Plan a greeting" : "Missing plan",
      agent: "test.claude-plan-smoke.harness.worker",
    });
    if (!withPlan) {
      for (
        let attempt = 0;
        attempt < 100 && (await request(`/sessions/${session.id}`)).status !== "completed";
        attempt++
      )
        await Bun.sleep(20);
      expect((await request(`/sessions/${session.id}`)).status).toBe("completed");
      const parts = (await request(`/sessions/${session.id}/conversation`)).messages.flatMap(
        (message: { parts: Array<{ type: string; tool?: string; status?: string }> }) => message.parts,
      );
      expect(
        parts.filter(
          (part: { tool?: string; status?: string }) => part.tool === "question" && part.status === "pending",
        ),
      ).toEqual([]);
      expect(parts).toContainEqual({ type: "text", text: "Revising the plan." });
      return;
    }
    for (
      let attempt = 0;
      attempt < 100 && (await request(`/sessions/${session.id}`)).status !== "awaiting_input";
      attempt++
    )
      await Bun.sleep(20);
    expect((await request(`/sessions/${session.id}`)).status).toBe("awaiting_input");
    const conversation = await request(`/sessions/${session.id}/conversation`);
    expect(conversation.messages.flatMap((message: { parts: unknown[] }) => message.parts)).toContainEqual(
      expect.objectContaining({ tool: "question", callId: "plan-tool", status: "pending" }),
    );
    await request(`/sessions/${session.id}/follow-up`, "POST", {
      prompt: "Approve and implement",
      question_response: { callId: "plan-tool", answers: [["Approve and implement"]] },
    });
    for (let attempt = 0; attempt < 100 && (await request(`/sessions/${session.id}`)).status !== "completed"; attempt++)
      await Bun.sleep(20);
    expect((await request(`/sessions/${session.id}`)).status).toBe("completed");
    expect((await request(`/sessions/${session.id}`)).agent_session_id).toBe("native-plan");
    const parts = (await request(`/sessions/${session.id}/conversation`)).messages.flatMap(
      (message: { parts: unknown[] }) => message.parts,
    );
    expect(parts).toContainEqual(
      expect.objectContaining({ tool: "question", callId: "plan-tool", status: "completed" }),
    );
    expect(parts).toContainEqual({ type: "text", text: expect.stringContaining("Implementing the greeting.") });
  } finally {
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
