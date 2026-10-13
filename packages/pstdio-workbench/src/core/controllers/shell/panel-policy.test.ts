import { expect, test } from "bun:test";
import { resolvePanelPolicy } from "./panel-policy";

test.each([
  true,
  false,
])("panel visibility follows availability (%s), authored visibility, intent, and tabs", (provided) => {
  for (const canOpen of [true, false]) {
    for (const authoredOpen of [true, false]) {
      for (const visibility of ["auto", "open", "closed"] as const) {
        for (const tabCount of [0, 1]) {
          const policy = resolvePanelPolicy({
            provided,
            authoredOpen,
            tabCount,
            visibility,
            settings: { canOpen, canClose: true },
          });
          const visible =
            provided &&
            (canOpen
              ? visibility !== "closed" && (visibility === "open" || tabCount > 0)
              : authoredOpen && visibility !== "closed");
          expect(policy.open).toBe(visible);
          expect(policy.canOpen).toBe(provided && canOpen);
        }
      }
    }
  }
});

test("fixed visible panels ignore stale closed intent and independent rules stay independent", () => {
  const policy = resolvePanelPolicy({
    provided: true,
    authoredOpen: true,
    tabCount: 0,
    visibility: "closed",
    settings: { canOpen: false, canClose: false, movable: false, resizable: true, acceptsTabs: true },
  });
  expect(policy).toMatchObject({
    open: true,
    canOpen: false,
    canClose: false,
    canToggle: false,
    acceptsTabs: true,
    resizable: true,
    movable: false,
  });
  expect(
    resolvePanelPolicy({ provided: true, tabCount: 1, settings: { size: { minPx: 80, maxPx: 80 } } }).resizable,
  ).toBe(false);
});

test("a header choice never grants another capability", () => {
  const policy = resolvePanelPolicy({
    provided: true,
    tabCount: 1,
    headerVisible: true,
    settings: {
      showHeader: false,
      canOpen: false,
      canClose: false,
      acceptsTabs: false,
      resizable: false,
      movable: false,
    },
  });
  expect(policy).toMatchObject({
    showHeader: true,
    canOpen: false,
    canClose: false,
    acceptsTabs: false,
    resizable: false,
    movable: false,
  });
});
