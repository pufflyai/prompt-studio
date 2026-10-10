import { expect, type Page } from "@playwright/test";

/** Exercise repeated host initialization against the actual packaged guest runtime. */
export const verifyPackagedViewInitialization = async (page: Page, runtimeUrl: string) => {
  const probe = await page.context().newPage();
  try {
    await probe.goto(page.url());
    await probe.evaluate((url) => {
      const frame = document.createElement("iframe");
      frame.title = "Initialization probe";
      frame.sandbox.add("allow-scripts");
      const moduleUrl = `data:text/javascript,${encodeURIComponent(`
        export default {
          async mount(element) {
            await new Promise(resolve => setTimeout(resolve, 0));
            const menu = document.createElement("div");
            menu.dataset.mountOwner = "active";
            document.body.appendChild(menu);
            return () => menu.remove();
          }
        };
      `)}`;
      const message = {
        moduleUrl,
        extensionId: "test.initialization",
        styles: [],
        props: {},
        theme: "light",
        themeVariables: {},
      };
      const sendInit = (callID: string) =>
        frame.contentWindow?.postMessage(
          { action: "RIMLESS/RPC_REQUEST", connectionID: "mount-probe", callName: "init", callID, args: [message] },
          "*",
        );
      window.addEventListener("message", (event) => {
        if (event.source !== frame.contentWindow) return;
        const data = event.data;
        if (data.action === "RIMLESS/HANDSHAKE_REQUEST") {
          frame.contentWindow?.postMessage(
            {
              action: "RIMLESS/HANDSHAKE_REPLY",
              connectionID: "mount-probe",
              schema: {},
              methodNames: ["call", "ready", "runtimeError"],
            },
            "*",
          );
        }
        if (data.action === "RIMLESS/HANDSHAKE_REPLY") {
          sendInit("first");
          sendInit("overlapping");
        }
        if (data.action === "RIMLESS/RPC_RESOLVE" && data.callID === "overlapping") sendInit("repeated");
        if (data.action === "RIMLESS/RPC_RESOLVE" && data.callID === "repeated") frame.dataset.initialized = "true";
      });
      frame.src = url;
      document.body.appendChild(frame);
    }, new URL(runtimeUrl, page.url()).href);

    await expect(probe.locator('iframe[title="Initialization probe"]')).toHaveAttribute("data-initialized", "true");
    await expect(probe.frameLocator('iframe[title="Initialization probe"]').locator("[data-mount-owner]")).toHaveCount(
      1,
    );
  } finally {
    await probe.close();
  }
};
