import { describe, expect, test } from "bun:test";
import { createContextKeyService } from "./context-key-service";

describe("createContextKeyService", () => {
  test("stores context keys and evaluates simple when clauses", () => {
    const context = createContextKeyService();

    context.set("resourceSelected", true);
    context.set("inputFocus", false);
    context.set("resourceKind", "session");

    expect(context.matches("resourceSelected && !inputFocus")).toBe(true);
    expect(context.matches("resourceKind == 'session' && !inputFocus")).toBe(true);
    expect(context.matches("resourceKind != 'workspace' && resourceSelected")).toBe(true);
    expect(context.matches("resourceKind == 'workspace'")).toBe(false);
  });
});
