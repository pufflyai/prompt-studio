import { describe, expect, test } from "bun:test";
import { resolvePrompt } from "./resolve-prompt";

const createMockDeps = (
  overrides: { template?: { id: string; content: string } | null; fileContent?: string | null } = {},
) => ({
  templateService: {
    getWithContent: async (_projectId: string, _name: string) =>
      overrides.template ??
      (overrides.fileContent !== undefined ? { id: "t1", content: overrides.fileContent ?? "" } : null),
  },
  filesRoot: "",
});

describe("resolvePrompt", () => {
  test("returns prompt as-is when prompt is provided", async () => {
    const result = await resolvePrompt({ prompt: "do the thing" }, "project-1", createMockDeps());
    expect(result).toBe("do the thing");
  });

  test("resolves template by name and renders with vars", async () => {
    const result = await resolvePrompt(
      { template: "fix-it", vars: { ticket: "PS-7" } },
      "project-1",
      createMockDeps({
        template: { id: "t1", content: "Fix issues in {{ticket}}/review.md" },
        fileContent: "Fix issues in {{ticket}}/review.md",
      }),
    );
    expect(result).toBe("Fix issues in PS-7/review.md");
  });

  test("throws when template is not found", async () => {
    expect(
      resolvePrompt({ template: "nonexistent" }, "project-1", createMockDeps({ template: null })),
    ).rejects.toMatchObject({
      message: "Prompt template not found: nonexistent",
      status: 404,
    });
  });

  test("throws when both prompt and template are provided", async () => {
    expect(resolvePrompt({ prompt: "inline", template: "tpl" }, "project-1", createMockDeps())).rejects.toMatchObject({
      message: "--prompt and --template are mutually exclusive",
      status: 400,
    });
  });

  test("renders template with multiple variables", async () => {
    const result = await resolvePrompt(
      { template: "multi", vars: { error: "segfault", ticket: "PS-3" } },
      "project-1",
      createMockDeps({
        template: { id: "t1", content: "Error: {{error}} in {{ticket}}" },
        fileContent: "Error: {{error}} in {{ticket}}",
      }),
    );
    expect(result).toBe("Error: segfault in PS-3");
  });

  test("renders template with no vars (empty interpolation)", async () => {
    const result = await resolvePrompt(
      { template: "simple" },
      "project-1",
      createMockDeps({
        template: { id: "t1", content: "No variables here" },
        fileContent: "No variables here",
      }),
    );
    expect(result).toBe("No variables here");
  });
});
