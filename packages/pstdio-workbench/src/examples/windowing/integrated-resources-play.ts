import { expect, userEvent, within } from "storybook/test";
import type { WindowingFixture } from "./fixture";
import { integratedLongNote } from "./integrated-fixture";
import { checkIntegratedInspector, checkIntegratedObjectProperty } from "./integrated-inspector-play";
import { integratedPanel, moveIntegratedTab } from "./integrated-ownership-play";
import { visibleWindowingLabel } from "./visible-label";

export const exerciseIntegratedResources = async (root: HTMLElement, fixture: WindowingFixture) => {
  const canvas = within(root);
  const user = userEvent.setup();
  const controls = () => within(canvas.getByRole("group", { name: "Integrated scenario controls" }));
  const panel = (id: string) => within(integratedPanel(root, id));
  await user.click(controls().getByRole("button", { name: "Note A" }));
  await user.type(canvas.getByRole("textbox", { name: "Notes draft" }), "One editor for Note A");
  await moveIntegratedTab(root, fixture, panel("main").getByRole("tab", { name: "Note A" }), "side");
  await expect(panel("main").getByRole("heading", { name: "Notes" })).toBeVisible();
  await user.click(controls().getByRole("button", { name: "Note B" }));
  await user.click(controls().getByRole("button", { name: "Note A" }));
  await expect(panel("side").getByRole("textbox", { name: "Notes draft" })).toHaveValue("One editor for Note A");
  await expect(canvas.getAllByRole("tab", { name: "Note A" })).toHaveLength(1);
  await expect(panel("main").getByRole("tab", { name: "Note B", selected: true })).toBeVisible();
  await user.click(controls().getByRole("button", { name: "Long note" }));
  await expect(panel("main").getByRole("tab", { name: integratedLongNote.label })).toBeVisible();
  await user.click(controls().getByRole("button", { name: "Sessions" }));
  await expect(panel("main").getByRole("heading", { name: "Sessions" })).toBeVisible();
  await expect(panel("main").getByRole("button", { name: /^Session 3/ })).toBeVisible();
  for (const name of ["Ticket A", "Ticket B", "Ticket A"]) {
    await user.click(controls().getByRole("button", { name }));
    await checkIntegratedInspector(root, name);
    await expect(visibleWindowingLabel(root, "Proposal binding")).toHaveTextContent(name);
  }
};

export const exerciseIntegratedModes = async (root: HTMLElement, fixture: WindowingFixture) => {
  const canvas = within(root);
  const user = userEvent.setup();
  const controls = () => within(canvas.getByRole("group", { name: "Integrated scenario controls" }));
  await user.click(controls().getByRole("button", { name: "Boombox" }));
  await expect(await canvas.findByRole("button", { name: "Pause" })).toBeVisible();
  await expect(canvas.queryByRole("button", { name: "Expand page" })).toBeNull();
  await expect(fixture.workbench.shell.getPanelPolicy("secondary").movable).toBe(false);
  await user.click(canvas.getByRole("button", { name: "Like current track" }));
  await expect(canvas.getByRole("button", { name: "Unlike current track" })).toBeVisible();
  await user.click(controls().getByRole("button", { name: "Kiln" }));
  await checkIntegratedObjectProperty(root, "Cube position X");
  await user.click(canvas.getByRole("button", { name: "Select Sphere animation" }));
  await checkIntegratedObjectProperty(root, "Sphere position X");
  const timeline = integratedPanel(root, "secondary");
  await expect(fixture.workbench.shell.getPanelPolicy("secondary").movable).toBe(false);
  const hide = canvas.queryByRole("button", { name: "Hide Sidebar" });
  if (hide) await user.click(hide);
  await expect(within(timeline).getByRole("button", { name: "Play animation" })).toBeVisible();
  await user.click(canvas.getByRole("button", { name: "Show Sidebar" }));
  await expect(await within(integratedPanel(root, "side")).findByText("Describe a change to the scene.")).toBeVisible();
  await checkIntegratedObjectProperty(root, "Sphere position X");
  await user.click(controls().getByRole("button", { name: "Workspace 1" }));
  await checkIntegratedInspector(root, "Workspace 1");
  await expect(within(integratedPanel(root, "side")).getByRole("tab", { name: "Note A" })).toBeVisible();
  await expect(canvas.queryByRole("alert")).toBeNull();
};
