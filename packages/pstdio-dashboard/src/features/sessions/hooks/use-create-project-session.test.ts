import { describe, expect, test } from "bun:test";
import { buildCreateProjectSessionBody } from "./use-create-project-session";

describe("buildCreateProjectSessionBody", () => {
  test("includes the selected agent browser model in new session requests", () => {
    expect(
      buildCreateProjectSessionBody({
        projectId: "project-1",
        prompt: "Start from the dashboard",
        agent: "opencode",
        model: " openai/gpt-5.5 ",
      }),
    ).toEqual({
      project_id: "project-1",
      title: "Start from the dashboard",
      prompt: "Start from the dashboard",
      agent: "opencode",
      model: "openai/gpt-5.5",
      workspace_id: undefined,
    });
  });
});
