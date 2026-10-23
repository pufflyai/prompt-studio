import { expect } from "bun:test";
import { folderProjectInput } from "../helpers/folder-project";
import { runTestCommand } from "../scripts/run-test-command";

export async function expectBriefSupervisorWakes(input: { baseUrl: string; headers: Record<string, string> }) {
  const { baseUrl, headers } = input;
  const request = async (path: string, method = "GET", body?: unknown) => {
    const response = await fetch(`${baseUrl}/v1${path}`, {
      method,
      headers: { ...headers, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    expect(response.ok).toBe(true);
    return response.json();
  };
  const projectInput = folderProjectInput({
    name: "supervisor-wake-smoke",
    agents: ["pstdio.workbench-fixture.harness.fake"],
  });
  const folder = projectInput.initial_workspace.params.path;
  await runTestCommand("git", ["init", "-b", "main", folder], {});
  await runTestCommand(
    "git",
    [
      "-C",
      folder,
      "-c",
      "user.name=Smoke",
      "-c",
      "user.email=smoke@example.com",
      "commit",
      "--allow-empty",
      "-m",
      "Initialize smoke repository",
    ],
    {},
  );
  const project = await request("/projects", "POST", projectInput);
  const execute = async (name: string, params: unknown = {}) => {
    const result = await request(
      `/projects/${project.id}/extensions/commands/pstdio.pstdio-planner.command.${name}/execute`,
      "POST",
      { params },
    );
    expect(result.outcome.status).toBe("success");
    return result.outcome.value;
  };
  const completedSupervisor = async (previousStart?: string) => {
    for (let check = 0; check < 100; check++) {
      const mode = await execute("auto-build.read");
      if (mode.supervisor?.status === "completed" && mode.supervisor.last_request_started !== previousStart)
        return mode.supervisor;
      await Bun.sleep(50);
    }
    throw new Error("The fixture supervisor did not finish its turn");
  };
  const brief = "Choose work for the packaged supervisor test.";
  try {
    await execute("create-ticket", { content: "# Supervisor work", status: "Todo" });
    const mode = await execute("auto-build.configure", { enabled: true, prompt: brief });
    const session = await completedSupervisor();
    await execute("auto-build.scope", { revision: mode.revision, queries: [{}] });
    await execute("auto-build");
    const resumed = await completedSupervisor(session.last_request_started);
    expect(resumed.id).toBe(session.id);
    const conversation = await request(`/sessions/${session.id}/conversation`);
    const prompts = conversation.messages
      .filter((message: { role: string }) => message.role === "user")
      .map((message: { parts: { type: string; text?: string }[] }) =>
        message.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text ?? "")
          .join("\n"),
      );
    expect(prompts.filter((prompt: string) => prompt.includes(brief))).toHaveLength(1);
    expect(prompts.length).toBeGreaterThan(1);
    for (const prompt of prompts.slice(1)) expect(prompt.length).toBeLessThan(prompts[0].length / 4);
    expect(prompts.at(-1)).not.toContain("auto-build scope");
    await execute("auto-build.pause");
    await execute("auto-build.resume");
    await execute("auto-build.check");
    const afterResume = await completedSupervisor(resumed.last_request_started);
    expect(afterResume.id).toBe(session.id);
    const updated = await execute("auto-build.configure", {
      enabled: true,
      prompt: "Choose changed work.",
      requireMergedDependencies: false,
    });
    expect((await completedSupervisor(afterResume.last_request_started)).id).toBe(session.id);
    const changed = await request(`/sessions/${session.id}/conversation`);
    const last = changed.messages.filter((message: { role: string }) => message.role === "user").at(-1);
    const text = last.parts
      .filter((part: { type: string }) => part.type === "text")
      .map((part: { text: string }) => part.text)
      .join("\n");
    expect(text).toContain("auto-build read");
    expect(text).toContain("auto-build scope");
    expect(text).not.toContain(updated.prompt);
    expect(text.length).toBeLessThan(prompts[0].length / 4);
    expect(await execute("auto-build.read")).toMatchObject({
      prompt: updated.prompt,
      requireMergedDependencies: false,
    });
    await execute("auto-build.configure", { enabled: false });
    const restartedBrief = "Start a fresh packaged Auto Build run.";
    await execute("auto-build.configure", { enabled: true, prompt: restartedBrief });
    const restarted = await completedSupervisor();
    expect(restarted.id).not.toBe(session.id);
    const restartedConversation = await request(`/sessions/${restarted.id}/conversation`);
    const restartedPrompts = restartedConversation.messages.filter(
      (message: { role: string }) => message.role === "user",
    );
    expect(restartedPrompts).toHaveLength(1);
    expect(restartedPrompts[0].parts).toContainEqual(
      expect.objectContaining({ text: expect.stringContaining(restartedBrief) }),
    );
    expect((await request(`/sessions/${session.id}/conversation`)).messages).toEqual(changed.messages);
    await execute("auto-build.configure", { enabled: false });
    const ticket = await execute("create-ticket", { content: "# Short managed implementation", status: "Todo" });
    const { attempt } = await execute("run-attempt", { ticket: ticket.id });
    const status = async () => (await execute("get-ticket", { id: ticket.id })).statusId;
    // Planner leaves progress to the agent: starting, requesting input, and answering keep the chosen status.
    expect(await status()).toBe("ready");
    const human = await execute("request-human", {
      ticket: ticket.id,
      workspaceId: attempt.workspaceId,
      sessionId: attempt.implementationSessionId,
      title: "Confirm scope",
      instructions: "Confirm before resuming the same attempt.",
      request: { kind: "task" },
    });
    expect(await status()).toBe("ready");
    await execute("review", { requestId: human.id, response: { confirmed: true } });
    expect(await status()).toBe("ready");
    expect(
      (await execute("list-attempts")).filter((row: { ticketId: string }) => row.ticketId === ticket.id),
    ).toHaveLength(1);
    expect(await execute("auto-build.read")).toMatchObject({ enabled: false });
  } finally {
    await execute("auto-build.configure", { enabled: false });
  }
}
