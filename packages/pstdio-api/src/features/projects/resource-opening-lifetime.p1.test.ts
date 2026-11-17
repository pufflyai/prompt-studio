import { expect, test } from "bun:test";
import { executeProjectExtensionCommand } from "../extensions/execute-project-extension-command";
import { resolveResourceOpenings } from "./resource-openers";
import { createPausedOpeningFixture } from "./resource-openers.test-fixture";

for (const end of ["cancelled", "returned"] as const) {
  test(`an installed caller that ${end} cannot dispatch an opener after its pending data read`, async () => {
    const fixture = await createPausedOpeningFixture("describe");
    const controller = new AbortController();
    const running = executeProjectExtensionCommand(fixture.deps, {
      projectId: fixture.project.id,
      commandId: "example.caller.command.open",
      body: { params: { detach: end === "returned" } },
      signal: controller.signal,
    });
    try {
      await fixture.entered.promise;
      if (end === "cancelled") controller.abort();
      else expect((await running).outcome.ok).toBe(true);
      fixture.release.resolve();
      await running;
      await fixture.finished.promise;
      expect(fixture.opened()).toBe(0);
    } finally {
      fixture.release.resolve();
      await running;
      await fixture.close();
    }
  });
}

test("disabling an awaiting command opener rejects its independently owned destination", async () => {
  const fixture = await createPausedOpeningFixture("inspect");
  const opening = resolveResourceOpenings(fixture.deps, { projectId: fixture.project.id }, [fixture.resource]);
  try {
    await fixture.entered.promise;
    await fixture.deps.extensionService.setProjectExtensionEnabled(fixture.reader.instance.id, false);
    fixture.release.resolve();
    expect((await opening)[0]?.target).toBeUndefined();
    const snapshot = await fixture.deps.extensionRuntimeCatalog.get(fixture.project.id);
    expect(snapshot.runtime.pages.some((page) => page.extensionId === "example.destination")).toBe(true);
  } finally {
    fixture.release.resolve();
    await opening;
    await fixture.close();
  }
});

test("cancellation during final configuration read rejects an opening", async () => {
  const fixture = await createPausedOpeningFixture("inspect");
  const controller = new AbortController();
  const finalRead = Promise.withResolvers<void>();
  const releaseRead = Promise.withResolvers<void>();
  const read = fixture.deps.projectInfoService.read.bind(fixture.deps.projectInfoService);
  let paused = false;
  fixture.deps.projectInfoService.read = async (projectId) => {
    const info = await read(projectId);
    if (fixture.opened() > 0 && !paused) {
      paused = true;
      finalRead.resolve();
      await releaseRead.promise;
    }
    return info;
  };
  const result = resolveResourceOpenings(
    fixture.deps,
    {
      projectId: fixture.project.id,
      signal: controller.signal,
    },
    [fixture.resource],
  ).then(
    () => "opened",
    (error: Error) => error.name,
  );
  try {
    fixture.release.resolve();
    await finalRead.promise;
    controller.abort();
    releaseRead.resolve();
    expect(await result).toBe("AbortError");
  } finally {
    releaseRead.resolve();
    await result;
    await fixture.close();
  }
});
