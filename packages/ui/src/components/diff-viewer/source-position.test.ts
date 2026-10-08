import { expect, test } from "bun:test";
import { sourcePositionSelection } from "./source-position";

test("clamps source ranges to the loaded document", () => {
  const model = { getLineCount: () => 3, getLineMaxColumn: (line: number) => (line === 3 ? 5 : 10) };
  expect(sourcePositionSelection({ line: 20, column: 99, endLine: 30 }, model)).toEqual({
    startLineNumber: 3,
    startColumn: 5,
    endLineNumber: 3,
    endColumn: 5,
  });
  expect(sourcePositionSelection({ line: 2, column: 4 }, model)).toEqual({
    startLineNumber: 2,
    startColumn: 4,
    endLineNumber: 2,
    endColumn: 4,
  });
});
