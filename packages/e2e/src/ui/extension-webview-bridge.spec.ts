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
