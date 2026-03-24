import { describe, expect, it } from "bun:test";

describe("ProjectList", () => {
  it("uses the shared project default path instead of hardcoding docs", async () => {
    const source = await Bun.file(new URL("./project-list.tsx", import.meta.url)).text();

    expect(source).toContain("resolveProjectDefaultPath(project.id)");
    expect(source).not.toContain("/projects/$projectId/docs");
  });
});
