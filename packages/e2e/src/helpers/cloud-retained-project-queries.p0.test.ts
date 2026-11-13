import { expect, test } from "bun:test";
import { viewDataEvents } from "@pstdio/sdk/extensions";
import { cloudQueryFixture } from "./cloud-retained-query.fixture";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

test("Cloud project preparation shares reads and follows only the selected project's workspace changes", async () => {
  const f = cloudQueryFixture();
  try {
    const project = f.queries.projectState();
    f.observe(project);
    f.observe(f.queries.projectState());
    await project.read();
    expect(project.getSnapshot().data).toEqual({ state: "ready" });
    expect(f.projectReads).toBe(1);
    f.setProjectState({ state: "failed", error: "Setup failed" });
    f.emit(viewDataEvents.workspacesChanged.id, "other");
    await turn();
    expect(f.projectReads).toBe(1);
    f.emit(viewDataEvents.workspacesChanged.id, "project");
    await project.read();
    expect(project.getSnapshot().data).toEqual({ state: "failed", error: "Setup failed" });
    expect(f.projectReads).toBe(2);
    f.detach();
    f.emit(viewDataEvents.workspacesChanged.id, "project");
    await turn();
    expect(f.projectReads).toBe(2);
  } finally {
    await f.dispose();
  }
});

test("an old Cloud project's queued preparation read cannot execute in a newly selected project", async () => {
  const f = cloudQueryFixture();
  try {
    const project = f.queries.projectState();
    f.project("other");
    await expect(project.read()).rejects.toThrow(/authority is closed|request is closed/);
    expect(f.projectReads).toBe(0);
    expect(project.getSnapshot().data).toBeUndefined();
  } finally {
    await f.dispose();
  }
});

test("a preparation command completed after leaving its project cannot publish into its old query", async () => {
  const f = cloudQueryFixture();
  const pending = f.holdProject();
  try {
    const project = f.queries.projectState();
    const reading = project.read();
    await turn();
    expect(f.projectReads).toBe(1);
    f.project("other");
    pending.resolve({ state: "failed", error: "Old project" });
    await expect(reading).rejects.toThrow(/authority is closed|request is closed/);
    expect(project.getSnapshot().data).toBeUndefined();
  } finally {
    pending.resolve({ state: "ready" });
    await f.dispose();
  }
});
