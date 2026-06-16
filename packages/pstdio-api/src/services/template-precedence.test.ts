import { describe, expect, test } from "bun:test";
import { mergeProjectAndExtensionTemplates } from "./template-precedence";

type TestTemplate = {
  name: string;
  template_type: string;
  source_kind: "project" | "extension";
  title?: string;
  is_default: boolean;
};

const tpl = (source_kind: "project" | "extension", name: string, extra: Partial<TestTemplate> = {}) => ({
  name,
  template_type: "prompt",
  source_kind,
  is_default: false,
  ...extra,
});

const project = (name: string, extra: Partial<TestTemplate> = {}) => tpl("project", name, extra);
const extension = (name: string, extra: Partial<TestTemplate> = {}) => tpl("extension", name, extra);

describe("mergeProjectAndExtensionTemplates", () => {
  test("a project template overrides a same-named extension template", () => {
    const result = mergeProjectAndExtensionTemplates(
      [project("review-code")],
      [extension("review-code"), extension("implement")],
    );

    const reviewEntries = result.filter((template) => template.name === "review-code");
    expect(reviewEntries).toHaveLength(1);
    expect(reviewEntries[0].source_kind).toBe("project");
    expect(result.map((template) => template.name)).toEqual(["implement", "review-code"]);
  });

  test("non-colliding extension templates are preserved", () => {
    const result = mergeProjectAndExtensionTemplates([project("custom")], [extension("review-code")]);

    expect(result.map((template) => `${template.source_kind}:${template.name}`)).toEqual([
      "project:custom",
      "extension:review-code",
    ]);
  });

  test("is_default follows the name onto the override when the shadowed extension held the default", () => {
    const result = mergeProjectAndExtensionTemplates(
      [project("review-code")],
      [extension("review-code", { is_default: true })],
    );

    expect(result.find((template) => template.name === "review-code")).toMatchObject({
      source_kind: "project",
      is_default: true,
    });
  });

  test("a default on the extension is preserved when no override shadows it", () => {
    const result = mergeProjectAndExtensionTemplates([], [extension("review-code", { is_default: true })]);

    expect(result[0]).toMatchObject({ source_kind: "extension", is_default: true });
  });

  test("the shadowed extension's display title follows the name onto the override", () => {
    const result = mergeProjectAndExtensionTemplates(
      [project("review-code", { title: "review-code" })],
      [extension("review-code", { title: "Review code" })],
    );

    expect(result.find((template) => template.name === "review-code")).toMatchObject({
      source_kind: "project",
      title: "Review code",
    });
  });

  test("is_default only transfers within the same template type", () => {
    const result = mergeProjectAndExtensionTemplates(
      [project("shared", { template_type: "prompt" })],
      [extension("shared", { template_type: "ticket", is_default: true })],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ source_kind: "project", template_type: "prompt", is_default: false });
  });
});
