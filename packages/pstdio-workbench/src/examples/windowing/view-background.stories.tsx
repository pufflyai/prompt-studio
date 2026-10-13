import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent } from "storybook/test";
import { createWindowingFixture } from "./fixture";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;

const backgroundStory = (background: "active" | "keep-mounted", mountStrategy?: "active" | "keep-mounted") =>
  ({
    args: {
      createFixture: () =>
        createWindowingFixture("windowing", {
          pagePanels: true,
          sessionBackground: background,
          sessionMountStrategy: mountStrategy,
        }),
    },
    play: async ({ canvasElement, canvas }) => {
      await userEvent.click(await canvas.findByRole("button", { name: "Session 1" }));
      const draft = await canvas.findByRole("textbox", { name: "Session draft" });
      await userEvent.type(draft, "Retained session draft");
      await userEvent.click(canvas.getByRole("button", { name: "Session 2" }));
      const side = canvasElement.querySelector('[data-workbench-panel="side"]')!;
      await expect(side.querySelectorAll("[data-workbench-instance] input")).toHaveLength(
        (mountStrategy ?? background) === "active" ? 1 : 2,
      );
      await userEvent.click(canvas.getByRole("button", { name: "Note A" }));
      await canvas.findByRole("textbox", { name: "Notes draft" });
      await userEvent.click(canvas.getByRole("button", { name: "Session 1" }));
      await expect(await canvas.findByRole("textbox", { name: "Session draft" })).toHaveValue(
        (mountStrategy ?? background) === "active" ? "" : "Retained session draft",
      );
    },
  }) satisfies Story;

export const ViewBackgroundActive = backgroundStory("active");
export const ViewBackgroundMounted = backgroundStory("keep-mounted");
export const ViewBackgroundLegacyMounted = backgroundStory("active", "keep-mounted");
export const ViewBackgroundLegacyActive = backgroundStory("keep-mounted", "active");
