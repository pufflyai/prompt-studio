import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { createNavigationExampleModule } from "./module";

describe("createNavigationExampleModule", () => {
  test("registers without missing menu commands", () => {
    const workbench = createWorkbenchCore();

    expect(() => workbench.registerModule(createNavigationExampleModule())).not.toThrow();
  });
});
