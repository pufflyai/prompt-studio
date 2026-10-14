import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";

const regions: Record<string, string> = {
  Main: "main",
  Side: "side",
  Secondary: "secondary",
  "Page side": "aside",
  "Page bottom": "bottom",
};

export const moveStoryTab = async (tab: HTMLElement, destination: string) => {
  const region = regions[destination];
  const instanceId = tab.closest("[data-workbench-tab]")!.getAttribute("data-workbench-tab")!;
  const body = within(document.body);
  const visible = (element: HTMLElement) => {
    for (let node: HTMLElement | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  if (region === "side" || region === "secondary") {
    const existing = document.querySelector<HTMLElement>(`[data-workbench-region="${region}"]`)!;
    if (!visible(existing))
      await userEvent.click(
        body.getByRole("button", {
          name: region === "side" ? "Show Sidebar" : "Show Bottom panel",
        }),
      );
  }
  if (region === "aside" || region === "bottom") {
    await userEvent.click(body.getByRole("button", { name: / panels$/ }));
    const opener = body.queryByRole("menuitemcheckbox", {
      name: region === "aside" ? "Side panel" : "Bottom panel",
    });
    if (opener?.getAttribute("aria-checked") === "false") await userEvent.click(opener);
    else await userEvent.keyboard("{Escape}");
  }
  const getTarget = () => document.querySelector<HTMLElement>(`[data-workbench-region="${region}"]`)!;
  await waitFor(() => expect(getTarget()).toBeVisible());
  const target = getTarget();
  let previous = "";
  await waitFor(() => {
    const current = JSON.stringify(target.getBoundingClientRect().toJSON());
    const stable = current === previous;
    previous = current;
    expect(stable).toBe(true);
  });
  await waitFor(() => {
    const end = target.getBoundingClientRect();
    const hit = document.elementFromPoint(end.x + end.width / 2, end.y + end.height / 2);
    expect(hit?.closest("[data-workbench-panel]")?.getAttribute("data-workbench-panel")).toBe(region);
  });
  const source = tab.getBoundingClientRect();
  fireEvent.mouseDown(tab, {
    button: 0,
    buttons: 1,
    clientX: source.x + source.width / 2,
    clientY: source.y + source.height / 2,
  });
  fireEvent.mouseMove(tab, {
    buttons: 1,
    clientX: source.x + source.width / 2 + 12,
    clientY: source.y + source.height / 2,
  });
  await waitFor(() => expect(document.querySelector(`[data-workbench-tab-drop="${region}"]`)).toBeVisible());
  const end = target.getBoundingClientRect();
  fireEvent.mouseMove(target, { buttons: 1, clientX: end.x + end.width / 2, clientY: end.y + end.height / 2 });
  await waitFor(() =>
    expect(document.querySelector(`[data-workbench-tab-drop="${region}"][data-drop-active]`)).toBeVisible(),
  );
  fireEvent.mouseUp(target, { button: 0, buttons: 0, clientX: end.x + end.width / 2, clientY: end.y + end.height / 2 });
  await waitFor(() => expect(document.querySelector(`[data-workbench-tab-drop="${region}"]`)).not.toBeVisible());
  await waitFor(() => {
    const container = region === "main" ? document.querySelector('[data-workbench-panel-header="main"]')! : getTarget();
    expect(container.querySelector(`[data-workbench-tab="${instanceId}"]`)).toBeVisible();
  });
  // Dnd-kit removes its post-drag click guard 50 ms after the pointer release.
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
};
