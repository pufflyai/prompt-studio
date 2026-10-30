import { describe, expect, test } from "bun:test";
import { priorityFromFile, selectPriorityTests, testRunner } from "./test-discovery";

describe("test priority discovery", () => {
  test("reads the priority independently of the runner and package", () => {
    expect(priorityFromFile("extensions/example/src/action.p0.test.ts")).toBe("P0");
    expect(priorityFromFile("packages/example/src/isolation.p1.test.ts")).toBe("P1");
    expect(priorityFromFile("packages/e2e/src/ui/editor.p2.spec.ts")).toBe("P2");
    expect(priorityFromFile("services/relay/src/storage.p1.integration.ts")).toBe("P1");
    expect(priorityFromFile("packages/example/src/throughput.p3.bench.ts")).toBe("P3");
  });

  test("rejects unclassified tests instead of silently losing their coverage", () => {
    expect(() => priorityFromFile("src/new-feature.test.ts")).toThrow("priority");
    expect(() => priorityFromFile("src/new-feature.p4.spec.ts")).toThrow("priority");
    expect(priorityFromFile("src/feature.test-fixture.ts")).toBeUndefined();
    expect(priorityFromFile("src/feature.ts")).toBeUndefined();
  });

  test("discovers new matching files without changing a test list", () => {
    const files = ["src/a.p0.test.ts", "src/b.p1.test.ts", "src/c.p2.test.ts", "src/helper.ts"];
    expect(selectPriorityTests(files, ["P0", "P1"])).toEqual(["src/a.p0.test.ts", "src/b.p1.test.ts"]);
    expect(selectPriorityTests([...files, "src/new.p1.test.ts"], ["P1"])).toEqual([
      "src/b.p1.test.ts",
      "src/new.p1.test.ts",
    ]);
    expect(selectPriorityTests(files, ["P2"])).toEqual(["src/c.p2.test.ts"]);
  });

  test("keeps application, component, packaged and native execution separate", () => {
    expect(testRunner("packages/pstdio-api/src/session.p1.test.ts")).toBe("api");
    expect(testRunner("packages/e2e/src/ui/session.p1.spec.ts")).toBe("app");
    expect(testRunner("packages/canvas-tests/src/ui/ui/menu.p1.spec.ts")).toBe("component");
    expect(testRunner("packages/e2e/src/packaged/startup.p1.test.ts")).toBe("packaged-cli");
    expect(testRunner("packages/e2e/src/packaged/startup.p1.spec.ts")).toBe("packaged-browser");
    expect(testRunner("clients/desktop/src/e2e/desktop-startup.p1.spec.ts")).toBe("desktop");
    expect(testRunner("src/action.p0.test.ts")).toBe("bun");
  });
});
