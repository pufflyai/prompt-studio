import { expect, userEvent, waitFor, within } from "storybook/test";
import type { WindowingFixture } from "./fixture";
import { integratedPanel } from "./integrated-ownership-play";
import { visibleWindowingLabel } from "./visible-label";

export const exerciseIntegratedShell = async (root: HTMLElement, fixture: WindowingFixture) => {
  const canvas = within(root);
  const body = within(document.body);
  const user = userEvent.setup();
  const files = () => canvas.getByRole("tab", { name: "Files" });
  const mount = visibleWindowingLabel(root, "Files mount").textContent;
  const header = within(root.querySelector<HTMLElement>('[data-workbench-panel-header="main"]')!);
  await user.click(header.getByRole("button", { name: "Add panel" }));
  await user.click(await body.findByRole("menuitem", { name: "Files" }));
  await expect(files()).toHaveAttribute("aria-selected", "true");
  await expect(canvas.getAllByRole("tab", { name: "Files" })).toHaveLength(1);
  await expect(visibleWindowingLabel(root, "Files mount")).toHaveTextContent(mount!);

  await user.click(canvas.getByRole("button", { name: "Hide Sidebar" }));
  await user.click(canvas.getByRole("button", { name: "Open Side Panel" }));
  await waitFor(() => expect(canvas.getByTestId("workbench-side-panel-floating")).toBeVisible());
  await expect(files()).toBeVisible();
  await expect(visibleWindowingLabel(root, "Files mount")).toHaveTextContent(mount!);
  await user.click(canvas.getByRole("button", { name: "Close Side Panel" }));
  await user.click(canvas.getByRole("button", { name: "Show Sidebar" }));
  await waitFor(() => expect(canvas.getByTestId("workbench-side-panel-attached")).toBeVisible());
  await expect(files()).toBeVisible();

  const bottom = integratedPanel(root, "bottom");
  const foreign = within(bottom).getByRole("tab", { name: /^Session 2/ });
  const id = foreign.closest("[data-workbench-tab]")!.getAttribute("data-workbench-tab")!;
  fixture.workbench.movePanel(id, "main");
  await user.click(within(bottom).getByRole("button", { name: "Close Terminal" }));
  await waitFor(() => expect(bottom).not.toBeVisible());
  await user.click(canvas.getByRole("button", { name: "Workspace panels" }));
  await user.click(await body.findByRole("menuitemcheckbox", { name: "Bottom panel" }));
  await expect(bottom).toBeVisible();
  await expect(within(bottom).queryByRole("tab")).toBeNull();
  await user.click(within(bottom).getByRole("button", { name: "Open Terminal" }));
  await expect(await within(bottom).findByRole("tab", { name: "Terminal" })).toBeVisible();
  await expect(visibleWindowingLabel(root, "Terminal lifecycle")).toHaveTextContent("Starts 1 · Stops 0");
};
