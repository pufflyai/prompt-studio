import { describe, expect, test } from "bun:test";
import { params } from "@pstdio/sdk/extensions";
import { validateCommandParams } from "./validate-params";

describe("validateCommandParams: workspace params", () => {
  const schema = { workspace: params.workspace({ providers: ["pstdio.worktree"] }) };

  test("accepts a listed provider with its params", () => {
    expect(
      validateCommandParams(schema, { workspace: { providerId: "pstdio.worktree", params: { base: "main" } } }),
    ).toEqual({ ok: true });
  });

  test("rejects a value without a provider id", () => {
    const result = validateCommandParams(schema, { workspace: { params: { base: "main" } } });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("providerId");
  });

  test("rejects provider params that are not an object", () => {
    const result = validateCommandParams(schema, { workspace: { providerId: "pstdio.worktree", params: "main" } });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("params");
  });

  test("rejects a provider outside the declared list", () => {
    const result = validateCommandParams(schema, { workspace: { providerId: "acme.cloud" } });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("pstdio.worktree");
  });

  test("accepts any provider when none are declared", () => {
    expect(
      validateCommandParams({ workspace: params.workspace() }, { workspace: { providerId: "acme.cloud" } }),
    ).toEqual({ ok: true });
  });
});

describe("declared provider params", () => {
  test("accepts custom choices when the provider allows them", async () => {
    const { resolveDeclaredParams } = await import("./validate-params");
    const schema = {
      image: params.select({ options: [{ label: "Small", value: "small" }], allowCustomValues: true }),
    };
    expect(resolveDeclaredParams(schema, { image: "custom" })).toEqual({ image: "custom" });
  });

  test("accepts command-backed provider choices and keeps required and type validation", async () => {
    const { resolveDeclaredParams } = await import("./validate-params");
    const schema = {
      image: params.select({
        required: true,
        options: { command: { kind: "command", id: "images" }, valueField: "id", labelField: "name" },
      }),
    };
    expect(resolveDeclaredParams(schema, { image: "small" })).toEqual({ image: "small" });
    expect(() => resolveDeclaredParams(schema, {})).toThrow("Missing required");
    expect(() => resolveDeclaredParams(schema, { image: 42 })).toThrow("must be a string");
    const multiple = { images: params.multiSelect({ options: schema.image.options }) };
    expect(resolveDeclaredParams(multiple, { images: ["small", "large"] })).toEqual({ images: ["small", "large"] });
    expect(() => resolveDeclaredParams(multiple, { images: [42] })).toThrow("string array");
  });

  test("fills defaults and rejects unknown keys and options", async () => {
    const { resolveDeclaredParams } = await import("./validate-params");
    const schema = {
      image: {
        type: "select" as const,
        required: true,
        defaultValue: "small",
        options: [{ label: "Small", value: "small" }],
      },
    };
    expect(resolveDeclaredParams(schema, {})).toEqual({ image: "small" });
    expect(() => resolveDeclaredParams(schema, { image: "large" })).toThrow("small");
    expect(() => resolveDeclaredParams({}, { typo: true })).toThrow("typo");
    expect(() => resolveDeclaredParams({ name: { type: "text", required: true } }, {})).toThrow("Missing required");
  });
});
