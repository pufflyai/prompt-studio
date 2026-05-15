import { describe, expect, test } from "bun:test";
import { buildCreateSessionBody } from "./session-create";

describe("buildCreateSessionBody", () => {
  test("builds the API body for a new session prompt", () => {
    expect(buildCreateSessionBody({ projectId: "project-1", prompt: "Implement the shell session view" })).toEqual({
      project_id: "project-1",
      title: "Implement the shell session view",
      prompt: "Implement the shell session view",
    });
  });
});
