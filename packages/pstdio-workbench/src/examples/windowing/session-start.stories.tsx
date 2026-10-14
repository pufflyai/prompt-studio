import { resourceKey } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWindowingFixture, type WindowingFixture } from "./fixture";
import { windowingExtensionId } from "./resources";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;
type Scenario = "empty" | "closed" | "visible" | "fixed" | "inactive";

const sessionStartStory = (scenario: Scenario) => {
  let fixture: WindowingFixture;
  return {
    args: {
      createFixture: () => {
        fixture = createWindowingFixture("windowing", {
          pagePanels: true,
          sessionStarts: true,
          registerPages: (core) => {
            if (scenario !== "inactive") return;
            core.modes.registerMode({ id: "other", activate() {} });
            core.pages.registerPage({
              id: "other",
              ref: { kind: "page", extensionId: windowingExtensionId, id: "other" },
              path: "other",
              modeId: "other",
              main: { kind: "view", view: { kind: "view", id: "windowing.files" }, cardinality: "one" },
              slots: [],
            });
          },
          ...(scenario === "fixed"
            ? { regionSettings: { side: { canOpen: false, canClose: false, floatable: false } } }
            : {}),
        });
        const core = fixture.workbench;
        if (scenario === "closed" || scenario === "visible") {
          core.openView({ viewId: "windowing.session", resource: fixture.resources.sessions[0]!, open: "pin" });
          if (scenario === "closed") core.shell.setRegionOpen("side", false);
        }
        if (scenario === "inactive") {
          const page = { kind: "page" as const, extensionId: windowingExtensionId, id: "other" };
          core.pageLocations.navigate({ kind: "page", page });
        }
        return fixture;
      },
    },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      await canvas.findByRole("textbox", { name: "Files draft" });
      const core = fixture.workbench;
      const start = canvas.getByRole("button", { name: "Start agent session" });
      start.focus();
      const sessions = fixture.resources.sessions.flatMap(
        (resource) => fixture.probe.store.getState().sessions[resourceKey(resource)] ?? [],
      );
      const before = {
        starts: sessions.reduce((total, session) => total + session.starts, 0),
        stops: sessions.reduce((total, session) => total + session.stops, 0),
        layout: core.layout.getLayout(),
        pages: core.pages.store.getState(),
        focus: core.focus.store.getState(),
      };
      await userEvent.click(start);
      const resource = fixture.resources.sessions.at(-1)!;
      await expect(resource.id).toBe("session-3");
      await expect(core.layout.getLayout()).toBe(before.layout);
      await expect(core.pages.store.getState()).toBe(before.pages);
      await expect(core.focus.store.getState()).toBe(before.focus);
      await expect(start).toHaveFocus();
      await expect(canvas.queryByRole("tab", { name: /Session 3/ })).toBeNull();
      await expect(canvas.getByLabelText("Started session lifecycle")).toHaveTextContent(
        `Starts ${before.starts + 1} · Stops ${before.stops}`,
      );
      await expect(fixture.probe.store.getState().sessions[resourceKey(resource)]).toEqual({
        starts: 1,
        stops: 0,
        running: true,
      });
      if (scenario === "fixed") {
        await expect(canvas.queryByRole("button", { name: "Hide Sidebar" })).toBeNull();
        await expect(canvas.queryByRole("button", { name: "Show Sidebar" })).toBeNull();
      }
      await userEvent.click(canvas.getByRole("button", { name: "Reload fixture" }));
      await waitFor(() => expect(fixture.workbench).not.toBe(core));
      await canvas.findByRole("textbox", { name: "Files draft" });
      await expect(
        Object.values(fixture.workbench.layout.getLayout().regions)
          .flatMap((region) => region.widgets)
          .filter((tab) => tab.resource?.id === resource.id),
      ).toHaveLength(0);
      await userEvent.click(canvas.getByRole("button", { name: "Sessions" }));
      await userEvent.click(await canvas.findByRole("button", { name: "Session 3 · workspace-2" }));
      await expect(await canvas.findByRole("textbox", { name: "Session draft" })).toBeVisible();
      const tabs = Object.values(fixture.workbench.layout.getLayout().regions)
        .flatMap((region) => region.widgets)
        .filter((tab) => tab.resource?.id === resource.id);
      await expect(tabs).toHaveLength(1);
      await expect(resourceKey(tabs[0]!.resource)).toBe(resourceKey(resource));
      await expect(fixture.probe.store.getState().sessions[resourceKey(resource)]).toEqual({
        starts: 1,
        stops: 0,
        running: true,
      });
    },
  } satisfies Story;
};

export const SessionStartEmpty = sessionStartStory("empty");
export const SessionStartClosed = sessionStartStory("closed");
export const SessionStartVisible = sessionStartStory("visible");
export const SessionStartFixed = sessionStartStory("fixed");
export const SessionStartInactive = sessionStartStory("inactive");
