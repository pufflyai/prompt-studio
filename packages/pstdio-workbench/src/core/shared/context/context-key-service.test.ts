import { describe, expect, test } from "bun:test";
import { createContextKeyService } from "./context-key-service";

describe("createContextKeyService", () => {
  test("stores context keys and evaluates simple when clauses", () => {
    const context = createContextKeyService();

    context.set("resourceSelected", true);
    context.set("inputFocus", false);
    context.set("resourceKind", "session");

    expect(context.matches("resourceSelected && !inputFocus")).toBe(true);
    expect(context.matches("inputFocus || resourceSelected")).toBe(true);
    expect(context.matches("resourceKind == 'session' && !inputFocus")).toBe(true);
    expect(context.matches("resourceKind != 'workspace' && resourceSelected")).toBe(true);
    expect(context.matches("resourceKind == 'workspace'")).toBe(false);
  });

  test("disposes owner-scoped keys without clearing host keys", () => {
    const context = createContextKeyService();
    const projectScope = context.createScope("project-mode");
    const reviewScope = context.createScope("review-mode");

    context.set("workbenchReady", true);
    projectScope.set("activeWorkbenchMode", "project");
    projectScope.set("workbenchMode.project", true);
    reviewScope.set("reviewVisible", true);

    expect(context.snapshot()).toMatchObject({
      workbenchReady: true,
      activeWorkbenchMode: "project",
      "workbenchMode.project": true,
      reviewVisible: true,
    });

    projectScope.dispose();

    expect(context.snapshot()).toEqual({
      workbenchReady: true,
      reviewVisible: true,
    });
  });
});
