import { describe, expect, test } from "bun:test";
import { renderPrompt } from "./render-prompt";

describe("renderPrompt", () => {
  test("renders commit-message template", () => {
    const result = renderPrompt("commit-message", { branch: "main", git_diff: "+hello" });

    expect(result).toContain("Branch: main");
    expect(result).toContain("+hello");
  });

  test("renders squash-message template with list", () => {
    const result = renderPrompt("squash-message", {
      commit_count: 2,
      commits: ["fix typo", "add feature"],
      git_diff: "+changed",
    });

    expect(result).toContain("2 commits");
    expect(result).toContain("- fix typo");
    expect(result).toContain("- add feature");
    expect(result).toContain("+changed");
  });

  test("renders implement-ticket template", () => {
    const result = renderPrompt("implement-ticket", { ticket_id: "PS-7" });

    expect(result).toBe("Implement ticket: PS-7");
  });
});
