import { describe, expect, test } from "bun:test";
import { createBridgeDocument } from "./bridge-document";

describe("createBridgeDocument", () => {
  test("uses an inline module URL that sandboxed bridge frames can import", () => {
    const document = createBridgeDocument({ runtimeScript: "window.__runtimeLoaded = true;" });

    try {
      expect(document.runtimeUrl).toStartWith("blob:");
      expect(document.moduleUrl).toStartWith("data:text/javascript");
    } finally {
      document.dispose();
    }
  });
});
