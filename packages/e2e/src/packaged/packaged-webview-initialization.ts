import { expect, type Page } from "@playwright/test";

/** Exercise repeated host initialization against the actual packaged guest runtime. */
export const verifyPackagedViewInitialization = async (page: Page, runtimeUrl: string) => {
  const probe = await page.context().newPage();
  try {
    // Keep the authenticated origin without starting a second Workbench on the same project storage.
    await probe.route(page.url(), (route) =>
      route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body></body></html>" }),
    );
    await probe.goto(page.url());
    await probe.evaluate((url) => {
      const frame = document.createElement("iframe");
      frame.title = "Initialization probe";
      frame.sandbox.add("allow-scripts");
      const moduleUrl = `data:text/javascript,${encodeURIComponent(`
        export default {
          async mount(element) {
            element.innerHTML = '<button>Pending view</button>';
            await new Promise(resolve => window.addEventListener('message', event => {
              if (event.data === 'release-mount') resolve();
            }));
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
      const replyToCall = (event: MessageEvent) => {
        const data = event.data;
        if (data.callName === "call" && data.args[0]?.method === "host.dispatchKeyboardEvent") {
          frame.dataset.forwardedKey = data.args[0].params.key;
        }
        frame.contentWindow?.postMessage(
          {
            action: "RIMLESS/RPC_RESOLVE",
            connectionID: "mount-probe",
            callID: data.callID,
            callName: data.callName,
            result: undefined,
          },
          "*",
        );
      };
      window.addEventListener("message", (event) => {
        if (event.source !== frame.contentWindow) return;
        const data = event.data;
        switch (data.action) {
          case "RIMLESS/HANDSHAKE_REQUEST":
            frame.contentWindow?.postMessage(
              {
                action: "RIMLESS/HANDSHAKE_REPLY",
                connectionID: "mount-probe",
                schema: {},
                methodNames: ["call", "ready", "runtimeError"],
              },
              "*",
            );
            break;
          case "RIMLESS/HANDSHAKE_REPLY":
            sendInit("first");
            sendInit("overlapping");
            break;
          case "RIMLESS/RPC_REQUEST":
            replyToCall(event);
            break;
          case "RIMLESS/RPC_RESOLVE":
            if (data.callID === "overlapping") sendInit("repeated");
            if (data.callID === "repeated") frame.dataset.initialized = "true";
        }
      });
      frame.src = url;
      document.body.appendChild(frame);
    }, new URL(runtimeUrl, page.url()).href);

    const pendingView = probe
      .frameLocator('iframe[title="Initialization probe"]')
      .getByRole("button", { name: "Pending view" });
    await pendingView.press("Escape");
    await expect(probe.locator('iframe[title="Initialization probe"]')).toHaveAttribute("data-forwarded-key", "Escape");
    await probe
      .locator('iframe[title="Initialization probe"]')
      .evaluate((frame: HTMLIFrameElement) => frame.contentWindow?.postMessage("release-mount", "*"));
    await expect(probe.locator('iframe[title="Initialization probe"]')).toHaveAttribute("data-initialized", "true");
    await expect(probe.frameLocator('iframe[title="Initialization probe"]').locator("[data-mount-owner]")).toHaveCount(
      1,
    );
  } finally {
    await probe.close();
  }
};
