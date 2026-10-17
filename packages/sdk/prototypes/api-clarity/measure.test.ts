import { expect, test } from "bun:test";
import { measureSource } from "./measure";

test("token measurement includes code after a template expression", () => {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: The fixture contains TypeScript source.
  const source = "function attachFile() { const value = `a${input.id}b`; return value; }";
  expect(measureSource(source).get("attachFile")?.tokens).toBe(14);
});
