import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { createSessionsModule } from "./module";

describe("createSessionsModule", () => {
  test("registers the session resource kind", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSessionsModule());

    expect(workbench.resources.getKind("session")).toMatchObject({
      label: "Session",
      icon: "MessageCircle",
    });
  });
});
