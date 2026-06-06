import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("pstdio skills extension contributions", () => {
  test("contributes shared pstdio skills", () => {
    expect(extension.skills?.create_pstdio_extension).toMatchObject({ title: "Create a pstdio extension" });
    expect(extension.skills?.pstdio).toMatchObject({ title: "Use pstdio" });
    expect(extension.templates).toBeUndefined();
  });
});
