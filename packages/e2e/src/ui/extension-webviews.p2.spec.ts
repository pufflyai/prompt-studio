import { folderProjectInput } from "../helpers/folder-project";
import { expect, test } from "../scripts/webview-test";
import { uiOrigin } from "../ui-server";

test("isolated webviews preserve project storage and live updates, then dispose when disabled", async ({
  page,
  request,
}) => {
  const projects: string[] = [];
  const create = async () => {
    const response = await request.post(`${uiOrigin}/v1/projects`, {
      data: folderProjectInput({ name: "Webview contract" }),
    });
    expect(response.ok()).toBe(true);
    const project = await response.json();
    projects.push(project.id);
    return project.id as string;
  };
  const open = async (project: string) => {
    await page.goto(`/projects/${project}/extensions/test.webview-host/host`);
    const iframe = page.locator('iframe[title="Host page"]');
    await expect(iframe.contentFrame().getByRole("heading", { name: "Host contract" })).toBeVisible();
    return iframe;
  };
  try {
    const first = await create();
    const second = await create();
    const iframe = await open(first);
    const guest = iframe.contentFrame();
    await expect(iframe).not.toHaveAttribute("sandbox", /allow-same-origin/);
    const frame = await (await iframe.elementHandle())!.contentFrame();
    await frame!.evaluate(() => Reflect.set(window, "retainedMarker", "original"));
    const response = await request.post(
      `${uiOrigin}/v1/projects/${first}/extensions/commands/test.webview-host.command.bump/execute`,
      { data: { params: {} } },
    );
    expect(response.ok()).toBe(true);
    await expect(guest.getByLabel("Counter")).toHaveText("1");
    expect(await frame!.evaluate(() => Reflect.get(window, "retainedMarker"))).toBe("original");
    await page.reload();
    await expect(guest.getByLabel("Counter")).toHaveText("1");
    await open(second);
    await expect(guest.getByLabel("Counter")).toHaveText("0");
    await open(first);
    await expect(guest.getByLabel("Counter")).toHaveText("1");
    const inventory = await (await request.get(`${uiOrigin}/v1/projects/${first}/extensions`)).json();
    const extension = inventory.extensions.find(
      (entry: { installName: string }) => entry.installName === "webview-host",
    );
    expect(extension).toBeTruthy();
    expect(
      (
        await request.patch(`${uiOrigin}/v1/projects/${first}/extensions/${extension.id}`, { data: { enabled: false } })
      ).ok(),
    ).toBe(true);
    await expect(iframe).toHaveCount(0);
  } finally {
    for (const project of projects) await request.delete(`${uiOrigin}/v1/projects/${project}`);
  }
});
