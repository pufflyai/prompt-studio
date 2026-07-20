import { describe, expect, test } from "bun:test";
import { extensionViewRegion } from "./extension-mode-layout";

describe("extension-mode-layout exports", () => {
  test("exposes extension view region placement for resource view callers", () => {
    expect(extensionViewRegion("workbench.main.left")).toBe("main-left-menu");
  });
});
