import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createWorkbenchTerminalModule, openWorkbenchTerminal } from "./terminal-module";

test("explicit terminal open validates the destination before adding a tab", () => {
  const core = createWorkbench({ regionSettings: { secondary: { canOpen: false } } });
  core.registerModule(createWorkbenchTerminalModule());
  core.shell.setRegionOpen("secondary", false);
  const layout = core.layout.getLayout();
  expect(() => openWorkbenchTerminal(core)).toThrow("cannot open");
  expect(core.layout.getLayout()).toBe(layout);
});
