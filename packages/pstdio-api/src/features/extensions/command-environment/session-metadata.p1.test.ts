import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { emitSessionCommandsChanged } from "../../sessions/session-command-events";
import { createSessionsApi } from "./sessions";

test("session metadata watches exact rows and workspace links before reading, and closes with its signal", async () => {
  const app = await createTestApp();
  const controller = new AbortController();
  try {
    const project = await app.deps.projectService.create({ name: "Metadata" });
    const session = await app.deps.sessionService.create({ project_id: project.id, title: "First", agent: "test" });
    const other = await app.deps.sessionService.create({ project_id: project.id, title: "Other", agent: "test" });
    const api = createSessionsApi(app.deps, { projectId: project.id, project: { ...project, shorthand: "M" } });
    const hints: string[] = [];
    const observation = await api.observeMetadata(session.id, (change) => hints.push(change), {
      signal: controller.signal,
    });
    await api.rename(other.id, "Unrelated");
    expect(hints).toEqual([]);
    await api.rename(session.id, "Selected");
    expect(hints).toContain("session");
    hints.length = 0;
    // Linking is an independent committed source; neither endpoint row must change.
    app.deps.eventBus.emit("workspace_sessions", "set", { id: "link", session_id: session.id, workspace_id: "new" });
    expect(hints).toContain("session");
    hints.length = 0;
    emitSessionCommandsChanged(app.deps.eventBus, session.id);
    expect(hints).toEqual(["harness"]);
    controller.abort();
    app.deps.eventBus.emit("sessions", "set", { id: session.id });
    expect(hints).toEqual(["harness"]);
    observation.close();
  } finally {
    controller.abort();
    await app.close();
  }
});
