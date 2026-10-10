import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

// The script runs in a sandboxed frame next to the webview, like an HTML artifact or another
// extension would. It forges the rimless handshake and init calls that only the host may send.
const forgedHostScript = `
  const view = "export default { mount() { document.body.dataset.forged = 'mounted'; } };";
  const init = {
    moduleUrl: "data:text/javascript," + encodeURIComponent(view),
    styles: [],
    props: {},
    theme: "dark",
    themeVariables: {},
    extensionId: "forged",
  };
  for (let index = 0; index < parent.frames.length; index += 1) {
    const target = parent.frames[index];
    if (target === window) continue;
    target.postMessage({ action: "RIMLESS/HANDSHAKE_REPLY", connectionID: "forged", methodNames: [], schema: {} }, "*");
    target.postMessage(
      { action: "RIMLESS/RPC_REQUEST", callID: "forged-init", callName: "init", connectionID: "forged", args: [init] },
      "*",
    );
  }
  parent.postMessage({ forgedHostMessagesSent: true }, "*");
`;

test("host messages to a webview leave no listeners on the host window", async ({ page, request }) => {
  const response = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Webview bridge listeners" }),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  try {
    await page.addInitScript((projectId: string) => {
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    }, project.id);
    await page.goto(`/projects/${project.id}/extensions/pstdio.workbench-fixture/lab`);
    const lab = page.frameLocator('iframe[title="Lab"]');
    const increment = lab.getByRole("button", { name: "Increment" });
    await expect(lab.getByText("0", { exact: true })).toBeVisible();

    const cdp = await page.context().newCDPSession(page);
    const hostMessageListeners = async () => {
      const { result } = await cdp.send("Runtime.evaluate", { expression: "window" });
      const objectId = result.objectId as string;
      const { listeners } = await cdp.send("DOMDebugger.getEventListeners", { objectId });
      await cdp.send("Runtime.releaseObject", { objectId });
      return listeners.filter((listener) => listener.type === "message").length;
    };
    await increment.click();
    await expect(lab.getByText("1", { exact: true })).toBeVisible();
    const baseline = await hostMessageListeners();

    // Each command sends the webview a props update and command events over the bridge.
    for (let counter = 2; counter <= 6; counter += 1) {
      await increment.click();
      await expect(lab.getByText(String(counter), { exact: true })).toBeVisible();
    }

    await expect.poll(hostMessageListeners).toBeLessThanOrEqual(baseline);
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
  }
});

test("a webview ignores bridge messages from frames other than its host", async ({ page, request }) => {
  const response = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Webview bridge origin" }),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  try {
    await page.addInitScript((projectId: string) => {
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    }, project.id);
    await page.goto(`/projects/${project.id}/extensions/pstdio.workbench-fixture/lab`);
    const lab = page.frameLocator('iframe[title="Lab"]');
    await expect(lab.getByRole("heading", { name: "Sandbox webview" })).toBeVisible();

    await page.evaluate((script) => {
      const sent = new Promise<void>((resolve) => {
        window.addEventListener("message", (event) => {
          if ((event.data as { forgedHostMessagesSent?: boolean })?.forgedHostMessagesSent) resolve();
        });
      });
      const attacker = document.createElement("iframe");
      attacker.setAttribute("sandbox", "allow-scripts");
      attacker.srcdoc = `<script>${script}</script>`;
      document.body.appendChild(attacker);
      return sent;
    }, forgedHostScript);
    // The forged view mounts within milliseconds when the guest accepts it.
    await page.waitForTimeout(500);

    await expect(lab.locator("body")).not.toHaveAttribute("data-forged", "mounted");
    await expect(lab.getByRole("heading", { name: "Sandbox webview" })).toBeVisible();
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
  }
});
