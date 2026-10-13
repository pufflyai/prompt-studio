import { expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { createWindowingFixture } from "./fixture";

test("starting a session publishes its resource without UI activation and survives reload", async () => {
  const fixture = createWindowingFixture("windowing", { pagePanels: true });
  const core = fixture.workbench;
  core.shell.setRegionOpen("side", false);
  const before = {
    layout: core.layout.getLayout(),
    pages: core.pages.store.getState(),
    focus: core.focus.store.getState(),
  };
  const resource = fixture.startSession(fixture.resources.workspaces[1]!);
  expect(core.layout.getLayout()).toBe(before.layout);
  expect(core.pages.store.getState()).toBe(before.pages);
  expect(core.focus.store.getState()).toBe(before.focus);
  const provider = core.resources.listProviders().find((provider) => provider.kind === "windowing.session")!;
  expect(await provider.list("", {})).toContainEqual({ resource });
  await fixture.reload();
  expect(
    Object.values(fixture.workbench.layout.getLayout().regions)
      .flatMap((region) => region.widgets)
      .filter((tab) => tab.resource?.id === resource.id),
  ).toHaveLength(0);
  expect(fixture.probe.store.getState().sessions[resourceKey(resource)]).toMatchObject({
    starts: 1,
    stops: 0,
    running: true,
  });
});
