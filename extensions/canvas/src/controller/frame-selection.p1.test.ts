import { expect, test } from "bun:test";
import { createFrameSelection } from "./frame-selection";

test("only one source frame is selected and selection can be cleared", () => {
  const selection = createFrameSelection(["form", "controls"]);
  expect(selection.get()).toBeUndefined();
  selection.select("form");
  expect(selection.get()).toBe("form");
  selection.select("controls");
  expect(selection.get()).toBe("controls");
  selection.select();
  expect(selection.get()).toBeUndefined();
});

test("selection ignores unknown frames and publishes only actual changes", () => {
  const selection = createFrameSelection(["form", "controls"]);
  const changes: (string | undefined)[] = [];
  const stop = selection.subscribe(() => changes.push(selection.get()));
  selection.select("unknown");
  selection.select("form");
  selection.select("form");
  selection.select("unknown");
  selection.select("controls");
  stop();
  selection.select();
  expect(changes).toEqual(["form", "controls"]);
  selection.select("form");
  selection.dispose();
  expect(selection.get()).toBeUndefined();
});
