import { expect, test } from "@playwright/test";
import { installWebviewKeyboardRelay, webviewKeyboardRelayDocument } from "@pstdio/sdk/extensions";

test("opaque nested content relays only negotiated entry intents and restores local editing", async ({ page }) => {
  const inner = `<!doctype html><html><head>${webviewKeyboardRelayDocument}<script>window.addEventListener('message',event=>{if(event.data?.type==='pstdio.keyboard.profile')document.documentElement.dataset.ready='true'});</script></head><body><textarea aria-label="Nested draft">Local draft</textarea><dialog><input aria-label="Modal draft"></dialog></body></html>`;
  const wrapper = `<!doctype html><html><head>${webviewKeyboardRelayDocument}</head><body><script>const child=document.createElement('iframe');child.title='Inner';child.sandbox='allow-scripts';child.srcdoc=${JSON.stringify(inner).replaceAll("</", "<\\/")};document.body.append(child);</script></body></html>`;
  await page.setContent('<output aria-label="Requests">[]</output>');
  const shortcuts = [
    { id: "leader", entry: "mode", key: "Space", altKey: true, shiftKey: true },
    { id: "bottom", entry: "panel", key: "B", altKey: true, shiftKey: true },
    { id: "side", entry: "panel", key: "E", altKey: true, shiftKey: true },
    { id: "forbidden", key: "X", altKey: true, shiftKey: true },
  ];
  await page.addScriptTag({
    content: `window.requests=[];window.relay=(${installWebviewKeyboardRelay.toString()})({shortcuts:()=>${JSON.stringify(shortcuts)},dispatch:request=>{window.requests.push(request);document.querySelector('output').textContent=JSON.stringify(window.requests)}});`,
  });
  await page.evaluate((wrapper) => {
    const frame = document.createElement("iframe");
    frame.title = "Outer";
    frame.sandbox.add("allow-scripts");
    frame.srcdoc = wrapper;
    document.body.append(frame);
  }, wrapper);
  const guest = page.frameLocator('iframe[title="Outer"]').frameLocator('iframe[title="Inner"]');
  await expect(guest.locator("html")).toHaveAttribute("data-ready", "true");
  const draft = guest.getByRole("textbox", { name: "Nested draft" });
  await draft.fill("Unsaved nested draft");
  await draft.press("ArrowLeft");
  await draft.press("Alt+Shift+Space");
  await expect(page.getByLabel("Requests")).toHaveText('[{"id":"leader","repeat":false,"nested":true}]');
  await expect(draft).toHaveValue("Unsaved nested draft");
  await page.evaluate(() =>
    document.querySelector("iframe")?.contentWindow?.postMessage({ type: "pstdio.keyboard.restore" }, "*"),
  );
  await expect(draft).toBeFocused();
  await draft.dispatchEvent("keydown", {
    key: "\u00a0",
    code: "Space",
    altKey: true,
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  const twoRequests = '[{"id":"leader","repeat":false,"nested":true},{"id":"leader","repeat":false,"nested":true}]';
  await expect(page.getByLabel("Requests")).toHaveText(twoRequests);
  await page.evaluate(() =>
    document.querySelector("iframe")?.contentWindow?.postMessage({ type: "pstdio.keyboard.restore" }, "*"),
  );
  await expect(draft).toBeFocused();
  await expect(draft).toHaveValue("Unsaved nested draft");
  await guest.locator("dialog").evaluate((dialog: HTMLDialogElement) => dialog.showModal());
  const modal = guest.getByRole("textbox", { name: "Modal draft" });
  await modal.press("Alt+Shift+Space");
  await modal.press("Alt+Shift+X");
  await expect(page.getByLabel("Requests")).toHaveText(twoRequests);
  const panelRequests = JSON.parse(twoRequests);
  for (const [key, symbol, id] of [
    ["B", "ı", "bottom"],
    ["E", "Dead", "side"],
  ] as const) {
    await modal.press(`Alt+Shift+${key}`);
    panelRequests.push({ id, repeat: false, nested: true });
    await expect(page.getByLabel("Requests")).toHaveText(JSON.stringify(panelRequests));
    await modal.dispatchEvent("keydown", {
      key: symbol,
      code: `Key${key}`,
      altKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    panelRequests.push({ id, repeat: false, nested: true });
    await expect(page.getByLabel("Requests")).toHaveText(JSON.stringify(panelRequests));
    await expect(modal).toBeFocused();
    await expect(modal).toHaveValue("");
  }
  await guest.locator("dialog").evaluate((dialog: HTMLDialogElement) => dialog.close());
  await draft.focus();
  await draft.press("Alt+Shift+X");
  await expect(page.getByLabel("Requests")).toHaveText(JSON.stringify(panelRequests));
  await expect(draft).toHaveValue("Unsaved nested draft");
});
