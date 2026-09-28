import { expect, test } from "bun:test";
import { extensionIframeAllow } from "./iframe-permissions";

test("delegates clipboard writes only when declared", () => {
  expect(extensionIframeAllow()).toBe("fullscreen");
  expect(extensionIframeAllow(["commands.execute"])).toBe("fullscreen");
  expect(extensionIframeAllow(["clipboard.write"])).toBe("fullscreen; clipboard-write");
  expect(extensionIframeAllow(["clipboard.write@1"])).toBe("fullscreen; clipboard-write");
  expect(extensionIframeAllow(["clipboard.write@2"])).toBe("fullscreen");
});
