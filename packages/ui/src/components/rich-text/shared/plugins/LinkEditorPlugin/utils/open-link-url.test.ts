import { afterEach, describe, expect, test } from "bun:test";
import { openLinkUrl } from "./open-link-url";

const originalWindow = globalThis.window;

describe("openLinkUrl", () => {
  afterEach(() => {
    globalThis.window = originalWindow;
  });

  test("opens unsupported protocols as about:blank without opener access", () => {
    const openedUrls: Parameters<Window["open"]>[] = [];
    globalThis.window = {
      open: (...args: Parameters<Window["open"]>) => {
        openedUrls.push(args);
        return null;
      },
    } as Window & typeof globalThis;

    openLinkUrl("javascript:alert(1)");

    expect(openedUrls).toEqual([["about:blank", "_blank", "noopener,noreferrer"]]);
  });
});
