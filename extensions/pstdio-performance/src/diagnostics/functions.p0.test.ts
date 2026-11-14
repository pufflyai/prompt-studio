import { expect, test } from "bun:test";
import { frequentFunctions } from "./functions";

test("CPU summaries combine a function reached through different callers", () => {
  const frame = { functionName: "decode", scriptId: "1", url: "file:///backend.ts", lineNumber: 4, columnNumber: 2 };
  const result = frequentFunctions({
    nodes: [
      { id: 1, callFrame: frame },
      { id: 2, callFrame: frame },
    ],
    samples: [1, 2, 2],
    startTime: 0,
    endTime: 10,
  });
  expect(result).toEqual({ total: 3, top: [{ name: "decode", location: "file:///backend.ts:4:2", count: 3 }] });
});

test("call summaries count function entries without double-counting branch ranges", () => {
  const result = frequentFunctions(undefined, [
    {
      scriptId: "1",
      url: "file:///backend.ts",
      functions: [
        {
          functionName: "decode",
          isBlockCoverage: true,
          ranges: [
            { startOffset: 0, endOffset: 100, count: 6 },
            { startOffset: 10, endOffset: 30, count: 4 },
          ],
        },
      ],
    },
  ]);
  expect(result.total).toBe(6);
  expect(result.top[0]?.count).toBe(6);
});
