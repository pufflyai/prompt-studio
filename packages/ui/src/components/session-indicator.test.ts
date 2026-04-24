import { describe, expect, it } from "bun:test";
import { CircleStop } from "lucide-react";
import { resolveSessionIndicatorColor, resolveSessionIndicatorIcon } from "./session-indicator";

describe("session indicator", () => {
  it("renders cancelled sessions as their own state", () => {
    expect(resolveSessionIndicatorIcon("cancelled")).toBe(CircleStop);
    expect(resolveSessionIndicatorColor("cancelled")).toBe("fg.warning");
  });
});
