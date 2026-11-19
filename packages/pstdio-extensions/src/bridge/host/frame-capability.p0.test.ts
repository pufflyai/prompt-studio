import { expect, test } from "bun:test";
import { frameDimensionChanged } from "./frame-capability";

test("retained view sizes keep hidden growth and ignore hidden zero measurements", () => {
  let visible = true;
  const sizes: number[] = [];
  const changed = frameDimensionChanged(
    true,
    (size) => sizes.push(size),
    () => visible,
  );
  changed(240);
  visible = false;
  changed(0);
  changed(280);
  visible = true;
  changed(320);
  expect(sizes).toEqual([240, 280, 320]);
});
