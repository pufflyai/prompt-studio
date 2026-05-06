import { describe, expect, test } from "bun:test";
import { classifyToolAction, type ToolBuckets } from "./tool-classification";

const buckets: ToolBuckets = {
  read: new Set(["read-tool"]),
  write: new Set(["write-tool"]),
  execute: new Set(["execute-tool"]),
  network: new Set(["network-tool"]),
};

describe("classifyToolAction", () => {
  test("classifies names from each bucket", () => {
    expect(classifyToolAction("read-tool", buckets)).toBe("read");
    expect(classifyToolAction("write-tool", buckets)).toBe("write");
    expect(classifyToolAction("execute-tool", buckets)).toBe("execute");
    expect(classifyToolAction("network-tool", buckets)).toBe("network");
  });

  test("falls back to other", () => {
    expect(classifyToolAction("unknown-tool", buckets)).toBe("other");
  });
});
