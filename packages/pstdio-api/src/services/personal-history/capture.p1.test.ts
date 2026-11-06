import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { capturePersonalHistory, captureSessionChanges } from "./capture";
import { createHistoryReferences, historyReferenceName } from "./references";
import { createPersonalHistoryStore } from "./store";

test("incremental session updates preserve the primary workspace and unlinked sessions", async () => {
  const source = await createTestApp();
  try {
    const project = await source.deps.projectService.create({ name: "Incremental history" });
    const first = await source.deps.workspaceService.createStandalone({ project_id: project.id, name: "First" });
    const second = await source.deps.workspaceService.createStandalone({ project_id: project.id, name: "Second" });
    const otherProject = await source.deps.projectService.create({ name: "Other project" });
    const foreignWorkspace = await source.deps.workspaceService.createStandalone({
      project_id: otherProject.id,
      name: "Other project workspace",
    });
    const linked = await source.deps.sessionService.create({
      project_id: project.id,
      title: "Linked",
      agent: "unavailable",
    });
    const unlinked = await source.deps.sessionService.create({
      project_id: project.id,
      title: "Unlinked",
      agent: "unavailable",
    });
    await source.deps.workspaceSessionService.link(first.id, linked.id);
    await source.deps.workspaceSessionService.link(second.id, linked.id);
    const history = createPersonalHistoryStore({
      projectId: project.id,
      managerOrigin: "https://manager.example",
      accountId: "alice",
      documents: source.deps.extensionStorageService.documents,
      files: source.deps.personalHistoryService.logs,
    });
    const input = {
      projectId: project.id,
      device: { ownerId: "alice", id: "source", name: "Laptop" },
      history,
      references: createHistoryReferences(
        source.deps.extensionStorageService.documents.open(historyReferenceName),
        project.id,
      ),
      deps: source.deps,
    };
    await capturePersonalHistory(input);
    await source.deps.sessionService.update(linked.id, { title: "Renamed linked" });
    await source.deps.sessionService.update(unlinked.id, { title: "Renamed unlinked" });
    await captureSessionChanges(input, [linked.id, unlinked.id]);
    const rows = await history.readRecords("sessions");
    expect(rows.find((row) => row.id === linked.id)).toMatchObject({
      title: "Renamed linked",
      workspace_id: first.id,
    });
    expect(rows.find((row) => row.id === unlinked.id)).toMatchObject({
      title: "Renamed unlinked",
      workspace_id: null,
    });
    await source.deps.workspaceSessionService.link(foreignWorkspace.id, unlinked.id);
    await captureSessionChanges(input, [unlinked.id]);
    expect((await history.readRecords("sessions")).find((row) => row.id === unlinked.id)).toHaveProperty(
      "workspace_id",
      null,
    );
  } finally {
    await source.close();
  }
});
