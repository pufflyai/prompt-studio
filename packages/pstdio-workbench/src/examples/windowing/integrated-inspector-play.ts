import { expect, userEvent, waitFor, within } from "storybook/test";
import { visibleWindowingLabel } from "./visible-label";

export const openIntegratedInspector = async (root: HTMLElement, title: string) => {
  // Closing Side changes Main's width and may reattach its menus during the transition.
  await waitFor(() => {
    let element = root.querySelector<HTMLElement>('[data-workbench-panel="main"]');
    while (element && root.contains(element)) {
      expect(element.getAnimations().filter((animation) => animation.playState === "running")).toHaveLength(0);
      element = element.parentElement;
    }
  });
  await userEvent.click(within(root).getByRole("button", { name: / panels$/ }));
  const item = await within(document.body).findByRole("menuitemcheckbox", { name: title });
  if (item.getAttribute("aria-checked") === "true") {
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(item).not.toBeVisible());
  } else {
    await userEvent.click(item);
  }
};

export const checkIntegratedInspector = async (root: HTMLElement, label: string) => {
  const visibleBinding = () => visibleWindowingLabel(document.body, "Inspector binding");
  await openIntegratedInspector(root, "Inspector");
  let surface!: HTMLElement;
  await waitFor(() => {
    const binding = visibleBinding();
    expect(binding).toHaveTextContent(label);
    surface = binding.closest<HTMLElement>("[data-workbench-panel-menu], [data-workbench-panel-menu-controls]")!;
  });
  await expect(surface.querySelector('[role="tablist"]')).toBeNull();
  await expect(surface.querySelector("[data-workbench-tab-drop]")).toBeNull();
  await dismissFloatingInspector(surface);
};

const dismissFloatingInspector = async (surface: HTMLElement) => {
  if (!surface.hasAttribute("data-workbench-panel-menu-controls")) return;
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(surface).not.toBeVisible());
};

export const checkIntegratedObjectProperty = async (root: HTMLElement, name: string) => {
  await openIntegratedInspector(root, "Scene and properties");
  let surface!: HTMLElement;
  await waitFor(() => {
    const input = visibleWindowingLabel(document.body, name);
    expect(input).toBeVisible();
    surface = input.closest<HTMLElement>("[data-workbench-panel-menu], [data-workbench-panel-menu-controls]")!;
  });
  await dismissFloatingInspector(surface);
};
