import { describe, expect, test } from "bun:test";
import { extensionViewArea } from "./extension-mode-layout";

describe("extension-mode-layout exports", () => {
  test("exposes extension view area placement for resource view callers", () => {
    expect(extensionViewArea("workbench.main.left")).toBe("main-left");
  });
});
