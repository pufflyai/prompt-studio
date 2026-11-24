import { expect, test } from "bun:test";
import { redactText } from "./process-output-redaction";

test("hides overlapping values in collected output", () => {
  expect(redactText("before abcdefg after", ["abc", "bcdefg"])).toBe("before [Redacted] after");
  expect(redactText("before abcdefg after", ["bcdefg", "abc"])).toBe("before [Redacted] after");
  expect(redactText("before abcdefg after", ["ab", "abc", "bcdefg"])).toBe("before [Redacted] after");
});

test("preserves neighboring text around long overlapping runs", () => {
  const repeated = "ab".repeat(25_000);
  expect(redactText(`一${repeated}🙂c`, ["aba", "bab", "b🙂c", "🙂", ""])).toBe("一[Redacted]");
  expect(redactText("🙂abc🙂abc🙂", ["abc"])).toBe("🙂[Redacted]🙂[Redacted]🙂");
});
