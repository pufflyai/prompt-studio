import { expect, userEvent, waitFor, within } from "storybook/test";
import type { WindowingFixture } from "./fixture";
import { checkIntegratedInspector } from "./integrated-inspector-play";
import { visibleWindowingLabel } from "./visible-label";

export const integratedPanel = (root: HTMLElement, region: string) =>
  root.querySelector<HTMLElement>(`[data-workbench-panel="${region}"]`)!;

export const moveIntegratedTab = async (
  root: HTMLElement,
  fixture: WindowingFixture,
  tab: HTMLElement,
  region: "main" | "side" | "aside" | "bottom",
) => {
  const id = tab.closest("[data-workbench-tab]")!.getAttribute("data-workbench-tab")!;
  fixture.workbench.movePanel(id, region);
  await waitFor(() => {
    const target =
      region === "main" ? root.querySelector('[data-workbench-panel-header="main"]')! : integratedPanel(root, region);
    expect(target.querySelector(`[data-workbench-tab="${id}"]`)).toBeVisible();
  });
};

export const exerciseIntegratedOwnership = async (root: HTMLElement, fixture: WindowingFixture) => {
  const canvas = within(root);
  const user = userEvent.setup();
  const controls = () => within(canvas.getByRole("group", { name: "Integrated scenario controls" }));
  const panel = (region: string) => within(integratedPanel(root, region));
  await user.click(canvas.getByRole("button", { name: "Hide Navigation" }));
  const files = await canvas.findByRole("textbox", { name: "Files draft" });
  await user.type(files, "Keep the workspace draft through moves, reset and fullscreen");
  const mount = panel("main").getByLabelText("Files mount").textContent;
  await user.click(panel("main").getByText("README.md"));
  await user.click(controls().getByRole("button", { name: "Session 2" }));
  await user.type(canvas.getByRole("textbox", { name: "Session draft" }), "A foreign session keeps its draft");
  await moveIntegratedTab(root, fixture, panel("side").getByRole("tab", { name: /^Session 2/ }), "bottom");
  await checkIntegratedInspector(root, "Workspace 1");
  await moveIntegratedTab(root, fixture, panel("main").getByRole("tab", { name: "Files" }), "aside");
  await expect(panel("aside").getByLabelText("Files mount")).toHaveTextContent(mount!);
  await expect(files).toHaveValue("Keep the workspace draft through moves, reset and fullscreen");
  await moveIntegratedTab(root, fixture, panel("aside").getByRole("tab", { name: "Files" }), "side");
  await user.click(controls().getByRole("button", { name: "Workspace 2" }));
  await checkIntegratedInspector(root, "Workspace 2");
  await expect(panel("side").getByLabelText("Files selected file")).toHaveTextContent("README.md");
  await expect(panel("side").getByLabelText("Files mount")).toHaveTextContent(mount!);
  await expect(visibleWindowingLabel(root, "Terminal resource")).toHaveTextContent("terminal-2");
  await expect(panel("secondary").getByLabelText("Mode tools binding")).toHaveTextContent("Project");
  await user.click(controls().getByRole("button", { name: "Workspace 1" }));
  await user.click(controls().getByRole("button", { name: "Reset page layout" }));
  await expect(panel("side").getByRole("tab", { name: "Files" })).toBeVisible();
  await expect(panel("main").queryByRole("tab", { name: "Files" })).toBeNull();
  await expect(files).toHaveValue("Keep the workspace draft through moves, reset and fullscreen");
  await user.click(panel("bottom").getByRole("tab", { name: /^Session 2/ }));
  await expect(panel("bottom").getByRole("textbox", { name: "Session draft" })).toHaveValue(
    "A foreign session keeps its draft",
  );
  await expect(panel("bottom").getByRole("tab", { name: /^Session 2/ })).toHaveAccessibleName(/Outside this workspace/);
  await user.click(canvas.getByRole("button", { name: "Expand page" }));
  await expect(canvas.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
  const snapshot = fixture.workbench.layout.getLayout();
  await user.click(controls().getByRole("button", { name: "Start session" }));
  await expect(controls().getByRole("button", { name: "Session 3" })).toBeVisible();
  await expect(fixture.workbench.layout.getLayout()).toBe(snapshot);
  await expect(canvas.queryByRole("tab", { name: /^Session 3/ })).toBeNull();
  await expect(files).toHaveValue("Keep the workspace draft through moves, reset and fullscreen");
  await user.keyboard("{Escape}");
  await expect(canvas.getByRole("button", { name: "Expand page" })).toHaveFocus();
  await user.click(panel("bottom").getByRole("tab", { name: "Terminal" }));
  await user.click(panel("bottom").getByRole("button", { name: "Close Terminal" }));
  await user.click(controls().getByRole("button", { name: "Reload fixture" }));
  await waitFor(() => expect(root.contains(files)).toBe(false));
  await user.click(controls().getByRole("button", { name: "Reset page layout" }));
  await user.click(await panel("bottom").findByRole("tab", { name: "Terminal" }));
  await waitFor(() => expect(visibleWindowingLabel(root, "Terminal resource")).toHaveTextContent("terminal-1"));
  await expect(visibleWindowingLabel(root, "Terminal lifecycle")).toHaveTextContent("Starts 1 · Stops 0");
  await expect(panel("side").getAllByRole("tab", { name: "Files" })).toHaveLength(1);
  await expect(canvas.queryByRole("tab", { name: /^Session 3/ })).toBeNull();
};
