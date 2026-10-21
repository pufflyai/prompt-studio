import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { WorkbenchStory } from "../../examples/workbench-story";
import { createFullscreenWorkbench } from "./fullscreen.fixture";

const meta = {
  title: "pstdio-workbench/Reference/Core API/Main fullscreen",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;

const fullscreenStory = (side: "attached" | "floating" | "closed", floatable = true, hiddenNav = false): Story => {
  const { w, lifecycle } = createFullscreenWorkbench(side, floatable, { hiddenNav });
  return {
    args: { workbench: w },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      const body = within(canvasElement.ownerDocument.body);
      const editor = await canvas.findByRole("textbox", { name: "Editor draft" });
      await userEvent.type(editor, "Unsaved Main draft");
      const snapshot = structuredClone(w.host.getSnapshot());
      const mounts = lifecycle.mounts;
      await userEvent.click(canvas.getByRole("button", { name: "Enter Main fullscreen" }));
      await expect(canvas.getByRole("button", { name: "Exit Main fullscreen" })).toBeVisible();
      await expect(editor).toBeVisible();
      expect(lifecycle.mounts).toBe(mounts);
      expect(lifecycle.unmounts).toBe(0);
      expect(w.host.getSnapshot()).toEqual(snapshot);
      if (floatable) {
        if (side === "closed") await userEvent.click(body.getByRole("button", { name: "Open Side Panel" }));
        await waitFor(() => expect(body.getByRole("dialog", { name: "Side Panel" })).toBeVisible());
        expect(body.getAllByLabelText("Side panel header")).toHaveLength(1);
        expect(body.queryByRole("button", { name: "Open Side Panel" })).toBeNull();
        await userEvent.click(body.getByRole("button", { name: "Close Side Panel" }));
        await expect(canvas.getByRole("button", { name: "Show fullscreen Side Panel" })).toHaveFocus();
        expect(body.queryAllByLabelText("Side panel header")).toHaveLength(0);
        const bubble = await body.findByRole("button", { name: "Open Side Panel" });
        await waitFor(() => expect(bubble).toBeVisible());
        await userEvent.click(bubble);
        await waitFor(() => expect(body.getByRole("dialog", { name: "Side Panel" })).toBeVisible());
        expect(w.host.getSnapshot()).toEqual(snapshot);
        await userEvent.click(body.getByRole("button", { name: "Close Side Panel" }));
        await waitFor(() => expect(body.getByRole("button", { name: "Open Side Panel" })).toBeVisible());
      } else {
        expect(canvas.queryByRole("button", { name: "Show fullscreen Side Panel" })).toBeNull();
        expect(body.queryByRole("button", { name: "Open Side Panel" })).toBeNull();
      }
      await userEvent.click(canvas.getByRole("button", { name: "Exit Main fullscreen" }));
      await expect(canvas.getByRole("button", { name: "Enter Main fullscreen" })).toHaveFocus();
      await expect(editor).toHaveValue("Unsaved Main draft");
      expect(w.host.getSnapshot()).toEqual(snapshot);
      expect(lifecycle.mounts).toBe(mounts);
      expect(lifecycle.unmounts).toBe(0);
    },
  };
};
export const AttachedSide = fullscreenStory("attached");
export const FloatingSide = fullscreenStory("floating");
export const ClosedSide = fullscreenStory("closed");
export const FixedSide = fullscreenStory("attached", false);
export const HiddenNavigation = fullscreenStory("attached", true, true);
export const RearrangedPanels = fullscreenStory("attached");
RearrangedPanels.args!.workbench!.shell.repositionPanel("side", "left");
RearrangedPanels.args!.workbench!.shell.repositionPanel("secondary", "top");

const navigation = createFullscreenWorkbench();
export const PageAndModeContinuity: Story = {
  args: { workbench: navigation.w },
  play: async ({ canvasElement }) => {
    const { w, lifecycle } = navigation;
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByRole("textbox", { name: "Editor draft" }), "First page draft");
    await userEvent.type(canvas.getByRole("textbox", { name: "Session draft" }), "Shared session draft");
    await userEvent.type(canvas.getByRole("textbox", { name: "Terminal draft" }), "Running terminal draft");
    const navigate = (id: string) =>
      w.pageLocations.navigate({ kind: "page", page: { kind: "page", extensionId: "fullscreen", id } });
    await userEvent.click(canvas.getByRole("button", { name: "Enter Main fullscreen" }));
    navigate("second");
    await waitFor(() => expect(canvas.getByRole("textbox", { name: "Editor draft" })).toHaveValue(""));
    expect(w.fullscreen.store.getState().active).toBe(true);
    navigate("other");
    await waitFor(() => expect(canvas.getByRole("button", { name: "Enter Main fullscreen" })).toBeVisible());
    navigate("first");
    await waitFor(() => expect(canvas.getByRole("textbox", { name: "Editor draft" })).toHaveValue("First page draft"));
    await expect(canvas.getByRole("textbox", { name: "Session draft" })).toHaveValue("Shared session draft");
    await expect(canvas.getByRole("textbox", { name: "Terminal draft" })).toHaveValue("Running terminal draft");
    expect(lifecycle.unmounts).toBe(0);
  },
};
