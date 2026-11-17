import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkbench, type WorkbenchCore } from "../../core";
import { useKeyboardTabs } from "./use-keyboard-tabs";

const TabHints = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const { tabs } = useKeyboardTabs(workbench);
  return <output>{tabs.map((tab) => `${tab.id}:${tab.number}`).join(",")}</output>;
};

test("idle tab hints leave numbered target geometry unread", () => {
  const workbench = createWorkbench();
  workbench.keyboard.registerTabStrip("main", () => {
    throw new Error("Hidden tab hints must not measure tab geometry");
  });
  expect(renderToStaticMarkup(<TabHints workbench={workbench} />)).toBe("<output></output>");
});
