import { expect, type Page } from "@playwright/test";

/** Count actual event responses, including any future resource endpoint, over HTTP/1.1. */
export const observeEventConnectionBudget = async (page: Page) => {
  const network = await page.context().newCDPSession(page);
  await network.send("Network.enable");
  const active = new Map<string, string>();
  const protocols: string[] = [];
  const paths: string[] = [];
  let maximum = 0;
  network.on("Network.responseReceived", ({ requestId, response }) => {
    if (!response.mimeType.includes("text/event-stream")) return;
    active.set(requestId, response.url);
    protocols.push(response.protocol ?? "unknown");
    paths.push(new URL(response.url).pathname);
    maximum = Math.max(maximum, active.size);
  });
  const closed = ({ requestId }: { requestId: string }) => active.delete(requestId);
  network.on("Network.loadingFinished", closed);
  network.on("Network.loadingFailed", closed);
  return {
    state: () => ({ maximum, protocols, paths, active: [...active.values()] }),
    assert() {
      expect(protocols.length).toBeGreaterThan(1);
      expect(new Set(protocols)).toEqual(new Set(["http/1.1"]));
      expect(maximum).toBeLessThanOrEqual(2);
      expect(paths.every((path) => path === "/v1/session-stream" || path === "/v1/sync/stream")).toBe(true);
    },
  };
};
