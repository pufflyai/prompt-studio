import { expect, type Locator, type Page } from "@playwright/test";
import { selectMenuAction } from "../helpers/menu-actions";

const selectTabAction = async (page: Page, tab: Locator, action: string) => {
  await tab.focus();
  await page.keyboard.press("Shift+F10");
  await selectMenuAction(page, action);
};

export const verifyPackagedDocumentState = async (page: Page, origin: string, projectId: string) => {
  const resource = `pstdio://extension-resource/glass-lab-artifact/layout?extensionId=pstdio.workbench-fixture&projectId=${projectId}`;
  const url = (document: string, route = "document-layout", section?: string) => {
    const target = new URL(`${origin}/projects/${projectId}/extensions/pstdio.workbench-fixture/${route}`);
    target.searchParams.set("resource", resource);
    target.searchParams.set("document", document);
    if (section) target.searchParams.set("section", JSON.stringify({ anchors: [{ id: section, heading: section }] }));
    return target.href;
  };
  const navigate = (document: string, route = "document-layout", section?: string) =>
    page.evaluate(
      (href) => {
        history.pushState(null, "", href);
        dispatchEvent(new PopStateEvent("popstate"));
      },
      url(document, route, section),
    );
  await page.goto(url("a"));
  const main = page.locator('[data-workbench-panel-header="main"]');
  const optional = main.getByRole("tab", { name: "Lab", exact: true });
  await expect(optional).toBeVisible();
  await main.getByRole("tab", { name: "Overview", exact: true }).click();
  const section = page.frameLocator('iframe[title="Overview"]:visible').getByLabel("Current section", { exact: true });
  await navigate("a", "document-layout", "first");
  await expect(section).toHaveText("first");
  await navigate("a", "document-layout", "second");
  await expect(section).toHaveText("second");
  await optional.focus();
  await optional.getByRole("button", { name: "Close Lab", exact: true }).click();
  await expect(optional).toHaveCount(0);
  await navigate("a", "document-layout", "first");
  await expect(section).toHaveText("first");
  await expect(optional).toHaveCount(0);
  await navigate("b");
  await expect(optional).toBeVisible();
  await navigate("a");
  await expect(optional).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Document layout");
  await expect(optional).toHaveCount(0);
  await navigate("b");
  await expect(optional).toBeVisible();
  await page.goto(url("a", "document-preview"));
  await expect(optional).toBeVisible();
  const placement = optional.locator("xpath=ancestor::*[@data-workbench-tab]");
  const a = (await placement.getAttribute("data-workbench-tab")) ?? "";
  expect(a).not.toBe("");
  await navigate("b", "document-preview");
  await expect(optional).toBeVisible();
  await expect(placement).not.toHaveAttribute("data-workbench-tab", a);
  await navigate("a", "document-preview");
  await expect(placement).toHaveAttribute("data-workbench-tab", a);
  await selectTabAction(page, optional, "Move to Side");
  const side = page
    .locator('[data-workbench-panel-header="side"]')
    .getByRole("tab", { name: "Lab", exact: true })
    .or(page.getByRole("dialog", { name: "Side Panel", exact: true }).getByRole("tab", { name: "Lab", exact: true }));
  await expect(side).toBeVisible();
  await navigate("b", "document-preview");
  await expect(optional).toBeVisible();
  await expect(side).toBeVisible();
  const b = (await placement.getAttribute("data-workbench-tab")) ?? "";
  await selectTabAction(page, optional, "Pin tab");
  await expect(optional).toHaveCSS("font-style", "normal");
  await selectTabAction(page, side, "Move to Main");
  const foreign = main.locator(`[data-workbench-tab=${JSON.stringify(a)}]`).getByRole("tab");
  await expect(foreign).toBeVisible();
  await selectTabAction(page, foreign, "Unpin tab");
  await expect(foreign).toHaveCSS("font-style", "italic");
  await selectTabAction(page, foreign, "Pin tab");
  await expect(foreign).toHaveCSS("font-style", "normal");
  await foreign.getByRole("button", { name: "Close Lab", exact: true }).click();
  await expect(foreign).toHaveCount(0);
  await expect(main.locator(`[data-workbench-tab=${JSON.stringify(b)}]`)).toBeVisible();
  await expect(page).toHaveURL(url("b", "document-preview"));

  await page.goto(url("b"));
  await expect(optional).toBeVisible();
  await selectTabAction(page, optional, "Move to Side");
  await expect(side).toBeVisible();
  const fallback = page.locator('[data-workbench-panel="main"] [data-workbench-instance]:visible').first();
  await expect(fallback).toBeVisible();
  const fallbackB = await fallback.getAttribute("data-workbench-instance");
  expect(fallbackB).not.toBeNull();
  await navigate("a");
  await expect(fallback).not.toHaveAttribute("data-workbench-instance", fallbackB!);
  await expect(optional).toHaveCount(0);
  await selectTabAction(page, side, "Move to Main");
  await expect(optional).toBeVisible();
  await optional.focus();
  await optional.getByRole("button", { name: "Close Lab", exact: true }).click();
  await expect(optional).toHaveCount(0);
  const fallbackA = await fallback.getAttribute("data-workbench-instance");
  expect(fallbackA).not.toBeNull();
  await navigate("b");
  await expect(fallback).not.toHaveAttribute("data-workbench-instance", fallbackA!);
  await expect(optional).toHaveCount(0);
};
