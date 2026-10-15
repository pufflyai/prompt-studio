import { expect, userEvent, waitFor, within } from "storybook/test";
import type { WindowingFixture } from "./fixture";
import { moveStoryTab } from "./tab-moves";

export const integratedPanel = (root: HTMLElement, region: string) =>
  root.querySelector<HTMLElement>(`[data-workbench-panel="${region}"]`)!;

export const exerciseIntegratedOwnership = async (root: HTMLElement, fixture: WindowingFixture) => {
  const canvas = within(root);
  const user = userEvent.setup();
  const controls = () => within(canvas.getByRole("group", { name: "Integrated scenario controls" }));
  const panel = (region: string) => within(integratedPanel(root, region));
  const files = await canvas.findByRole("textbox", { name: "Files draft" });
  await user.type(files, "Keep the workspace draft through moves, reset and fullscreen");
  const mount = panel("main").getByLabelText("Files mount").textContent;
  await user.click(panel("main").getByText("README.md"));
  await user.click(controls().getByRole("button", { name: "Session 2", exact: true }));
  await user.type(canvas.getByRole("textbox", { name: "Session draft" }), "A foreign session keeps its draft");
  await moveStoryTab(panel("side").getByRole("tab", { name: /^Session 2/ }), "Page bottom");
  await expect(canvas.getByLabelText("Inspector binding")).toHaveTextContent("Workspace 1");
  await moveStoryTab(panel("main").getByRole("tab", { name: "Files", exact: true }), "Page side");
  await expect(panel("aside").getByLabelText("Files mount")).toHaveTextContent(mount!);
  await expect(files).toHaveValue("Keep the workspace draft through moves, reset and fullscreen");
  await moveStoryTab(panel("aside").getByRole("tab", { name: "Files", exact: true }), "Side");
  await user.click(controls().getByRole("button", { name: "Workspace 2", exact: true }));
  await expect(canvas.getByLabelText("Inspector binding")).toHaveTextContent("Workspace 2");
  await expect(panel("side").getByLabelText("Files selected file")).toHaveTextContent("README.md");
  await expect(panel("side").getByLabelText("Files mount")).toHaveTextContent(mount!);
  await expect(panel("bottom").getByLabelText("Terminal resource")).toHaveTextContent("terminal-2");
  await expect(panel("secondary").getByLabelText("Mode tools binding")).toHaveTextContent("Project");
  await user.click(controls().getByRole("button", { name: "Workspace 1", exact: true }));
  await user.click(controls().getByRole("button", { name: "Reset page layout", exact: true }));
  await expect(panel("side").getByRole("tab", { name: "Files", exact: true })).toBeVisible();
  await expect(panel("main").queryByRole("tab", { name: "Files", exact: true })).toBeNull();
  await expect(files).toHaveValue("Keep the workspace draft through moves, reset and fullscreen");
  await user.click(panel("bottom").getByRole("tab", { name: /^Session 2/ }));
  await expect(panel("bottom").getByRole("textbox", { name: "Session draft" })).toHaveValue(
    "A foreign session keeps its draft",
  );
  await expect(panel("bottom").getByRole("tab", { name: /^Session 2/ })).toHaveAccessibleName(/Outside this workspace/);
  await user.click(canvas.getByRole("button", { name: "Expand page", exact: true }));
  await expect(canvas.getByRole("button", { name: "Exit fullscreen", exact: true })).toBeVisible();
  const snapshot = fixture.workbench.layout.getLayout();
  await user.click(controls().getByRole("button", { name: "Start session", exact: true }));
  await expect(controls().getByRole("button", { name: "Session 3", exact: true })).toBeVisible();
  await expect(fixture.workbench.layout.getLayout()).toBe(snapshot);
  await expect(canvas.queryByRole("tab", { name: /^Session 3/ })).toBeNull();
  await expect(files).toHaveValue("Keep the workspace draft through moves, reset and fullscreen");
  await user.keyboard("{Escape}");
  await expect(canvas.getByRole("button", { name: "Expand page", exact: true })).toHaveFocus();
  await user.click(panel("bottom").getByRole("tab", { name: "Terminal", exact: true }));
  await user.click(panel("bottom").getByRole("button", { name: "Close Terminal", exact: true }));
  await user.click(controls().getByRole("button", { name: "Reload fixture", exact: true }));
  await waitFor(() => expect(root.contains(files)).toBe(false));
  await user.click(controls().getByRole("button", { name: "Reset page layout", exact: true }));
  await expect(await panel("bottom").findByRole("tab", { name: "Terminal", exact: true })).toBeVisible();
  await expect(panel("bottom").getByLabelText("Terminal resource")).toHaveTextContent("terminal-1");
  await expect(panel("bottom").getByLabelText("Terminal lifecycle")).toHaveTextContent("Starts 1 · Stops 0");
  await expect(panel("side").getAllByRole("tab", { name: "Files", exact: true })).toHaveLength(1);
  await expect(canvas.queryByRole("tab", { name: /^Session 3/ })).toBeNull();
};
