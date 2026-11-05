import { expect, type Page } from "@playwright/test";

/** Exercise repeated host initialization against the actual packaged guest runtime. */
export const verifyPackagedViewInitialization = async (page: Page, runtimeUrl: string) => {
  const viewport = page.viewportSize()!;
  const probe = await page.context().newPage();
  try {
    await probe.goto(page.url());
    await probe.evaluate((url) => {
      const frame = document.createElement("iframe");
      frame.title = "Initialization probe";
      frame.sandbox.add("allow-scripts");
      // Chromium throttles layout observers in opaque iframes below the viewport.
      Object.assign(frame.style, { position: "fixed", top: "0", left: "0" });
      const moduleUrl = `data:text/javascript,${encodeURIComponent(`
        export default {
          async mount(element) {
            await new Promise(resolve => setTimeout(resolve, 0));
            const menu = document.createElement("div");
            menu.dataset.mountOwner = "active";
            document.body.appendChild(menu);
            const label = document.createElement("button");
            label.textContent = "Short status";
            label.dataset.initialHidden = String(document.hidden);
            label.onclick = () => { label.textContent = "A much longer status after an update"; };
            element.appendChild(label);
            return () => { menu.remove(); label.remove(); };
          }
        };
      `)}`;
      const message = {
        visible: false,
        sizing: "content-width",
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
      const resizeFromGuest = (data: MessageEvent["data"]) => {
        if (data.action === "RIMLESS/RPC_REQUEST" && data.callName === "contentWidthChanged") {
          frame.style.width = `${data.args[0]}px`;
          frame.dataset.contentWidth = String(data.args[0]);
          frame.contentWindow?.postMessage({ ...data, action: "RIMLESS/RPC_RESOLVE", result: null }, "*");
        }
      };
      const pointerEvents: string[] = [];
      const pointerFromGuest = (data: MessageEvent["data"]) => {
        if (data.action !== "RIMLESS/RPC_REQUEST" || data.callName !== "dispatchPointerEvent") return;
        pointerEvents.push(data.args[0].type);
        frame.dataset.pointerEvents = pointerEvents.join(",");
        frame.contentWindow?.postMessage({ ...data, action: "RIMLESS/RPC_RESOLVE", result: null }, "*");
      };
      window.addEventListener("message", (event) => {
        if (event.source !== frame.contentWindow) return;
        const data = event.data;
        if (data.action === "RIMLESS/HANDSHAKE_REQUEST") {
          frame.contentWindow?.postMessage(
            {
              action: "RIMLESS/HANDSHAKE_REPLY",
              connectionID: "mount-probe",
              schema: {},
              methodNames: ["call", "ready", "runtimeError", "contentWidthChanged", "dispatchPointerEvent"],
            },
            "*",
          );
        }
        if (data.action === "RIMLESS/HANDSHAKE_REPLY") {
          sendInit("first");
          sendInit("overlapping");
        }
        resizeFromGuest(data);
        pointerFromGuest(data);
        if (data.action === "RIMLESS/RPC_RESOLVE" && data.callID === "overlapping") sendInit("repeated");
        if (data.action === "RIMLESS/RPC_RESOLVE" && data.callID === "repeated") frame.dataset.initialized = "true";
      });
      frame.src = url;
      document.body.appendChild(frame);
    }, new URL(runtimeUrl, page.url()).href);

    await expect(probe.locator('iframe[title="Initialization probe"]')).toHaveAttribute("data-initialized", "true");
    // The packaged guest keeps its document while the host pauses and resumes its presentation.
    const status = probe.frameLocator('iframe[title="Initialization probe"]').getByRole("button");
    await expect(status).toHaveAttribute("data-initial-hidden", "true");
    for (const visible of [false, true]) {
      await probe.locator('iframe[title="Initialization probe"]').evaluate((element, next) => {
        (element as HTMLIFrameElement).contentWindow!.postMessage(
          {
            action: "RIMLESS/RPC_REQUEST",
            connectionID: "mount-probe",
            callName: "visibilityUpdate",
            callID: `visibility-${next}`,
            args: [next],
          },
          "*",
        );
      }, visible);
      await expect.poll(() => status.evaluate(() => document.visibilityState)).toBe(visible ? "visible" : "hidden");
    }

    await expect(probe.frameLocator('iframe[title="Initialization probe"]').locator("[data-mount-owner]")).toHaveCount(
      1,
    );
    const iframe = probe.locator('iframe[title="Initialization probe"]');
    await expect(iframe).toHaveAttribute("data-content-width", /^[1-9]\d*$/);
    const before = (await iframe.boundingBox())!.width;
    await probe
      .frameLocator('iframe[title="Initialization probe"]')
      .getByRole("button", { name: "Short status" })
      .click();
    await expect.poll(async () => (await iframe.boundingBox())!.width).toBeGreaterThan(before);
    await expect(iframe).toHaveAttribute("data-pointer-events", "pointerdown,click");
  } finally {
    await probe.close();
    // Restore Chromium's active compositor after closing the probe (ADR 0128).
    await page.bringToFront();
    await page.setViewportSize({ ...viewport, height: viewport.height + 1 });
    await page.setViewportSize(viewport);
  }
};
