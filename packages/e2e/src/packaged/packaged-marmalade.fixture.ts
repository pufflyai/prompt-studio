import { expect, type Page } from "../scripts/playwright-test";
import { type RuntimeDescriptor, runtimeAuthorization } from "./packaged-serve-helpers";

interface Device {
  host: { baseUrl: string; descriptor: RuntimeDescriptor };
}
export const marmaladeFrames = (page: Page) => ({
  rail: page.frameLocator('iframe[title="Marmalade tools"]:visible'),
  inspector: page.frameLocator('iframe[title="Properties and layers"]:visible'),
  canvas: page.frameLocator('iframe[title="Great Wave"]:visible'),
  nav: page.frameLocator('iframe[title="Marmalade"]:visible'),
  status: page.frameLocator('iframe[title="Document status"]:visible'),
});
export const openMarmalade = async (page: Page, device: Device, projectId: string) => {
  await page.goto(`${device.host.baseUrl}/projects/${projectId}/`);
  await page.getByRole("option", { name: "Marmalade", exact: true }).click();
  for (const title of ["Great Wave", "Properties and layers", "Marmalade tools", "Marmalade", "Document status"])
    await expect(page.locator(`iframe[title="${title}"]:visible`)).toBeVisible();
  await expect(marmaladeFrames(page).inspector.getByRole("option", { name: "Caption", exact: true })).toBeVisible();
};
export const marmaladeCommand = async (device: Device, projectId: string, id: string, params: object = {}) => {
  const response = await fetch(
    `${device.host.baseUrl}/v1/projects/${projectId}/extensions/commands/pstdio.extension-lab.command.${id}/execute`,
    {
      method: "POST",
      headers: { ...runtimeAuthorization(device.host.descriptor), "content-type": "application/json" },
      body: JSON.stringify({ params }),
    },
  );
  expect(response.ok).toBe(true);
  const result = await response.json();
  expect(result.outcome.ok, JSON.stringify(result)).toBe(true);
  return result.outcome.value;
};
export const readMarmaladePresentation = async (device: Device, projectId: string) => {
  const result = await marmaladeCommand(device, projectId, "marmalade.presentation.read");
  return Object.fromEntries(
    result.changes.map((change: { path: string[]; value: unknown }) => [change.path[0], change.value]),
  );
};
export const observeMarmaladeReads = (page: Page) => {
  const commands: string[] = [];
  page.on("request", (request) => {
    const id = /\/commands\/([^/]+)\/execute/.exec(request.url())?.[1];
    if (id?.endsWith("marmalade.session.read")) commands.push(id);
  });
  return commands;
};
