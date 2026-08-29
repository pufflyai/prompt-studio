import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("pstdio skills extension contributions", () => {
  test("contributes shared pstdio skills", () => {
    expect(extension.skills?.find((skill) => skill.id === "create-pstdio-extension")).toMatchObject({
      title: "Create a pstdio extension",
    });
    expect(extension.skills?.find((skill) => skill.id === "pstdio")).toMatchObject({ title: "Use pstdio" });
    expect(extension.templates).toBeUndefined();
  });
});
