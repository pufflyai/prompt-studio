import { describe, expect, test } from "bun:test";
import { readProjectRepoDiff } from "./project-repo-diff";

describe("project repo diff data", () => {
  test("reads changed files from project repo roots and prefixes paths by repo name", async () => {
    const runCalls: Array<{ command: string[]; cwd?: string }> = [];
    const process = {
      async run(input: { command: string[]; cwd?: string }) {
        runCalls.push(input);
        const command = input.command.join(" ");
        if (command === "git diff --name-status HEAD") {
          return { exitCode: 0, stdout: "M\tsrc/app.ts\n", stderr: "" };
        }
        if (command === "git ls-files --others --exclude-standard") {
          return { exitCode: 0, stdout: "notes/todo.md\n", stderr: "" };
        }
        if (command === "git diff --numstat HEAD -- src/app.ts") {
          return { exitCode: 0, stdout: "2\t1\tsrc/app.ts\n", stderr: "" };
        }
        if (command === "git show HEAD:src/app.ts") {
          return { exitCode: 0, stdout: "old app\n", stderr: "" };
        }
        throw new Error(`Unexpected command: ${command}`);
      },
    };

    const result = await readProjectRepoDiff({
      process,
      readFile: async (path) => (path.endsWith("src/app.ts") ? "new app\n" : "todo\nitem\n"),
      repos: {
        async list() {
          return [{ repoId: "repo-1", path: "/repos/prompt-studio", projectId: "project-1" }];
        },
      },
    });

    expect(result.files).toEqual([
      {
        repoId: "repo-1",
        repoLabel: "prompt-studio",
        filePath: "prompt-studio/src/app.ts",
        oldPath: "prompt-studio/src/app.ts",
        newPath: "prompt-studio/src/app.ts",
        change: "modified",
        additions: 2,
        deletions: 1,
        oldContent: "old app\n",
        newContent: "new app\n",
      },
      {
        repoId: "repo-1",
        repoLabel: "prompt-studio",
        filePath: "prompt-studio/notes/todo.md",
        oldPath: "prompt-studio/notes/todo.md",
        newPath: "prompt-studio/notes/todo.md",
        change: "added",
        additions: 2,
        deletions: 0,
        oldContent: "",
        newContent: "todo\nitem\n",
      },
    ]);
    expect(result.changedFilePaths).toEqual(["prompt-studio/src/app.ts", "prompt-studio/notes/todo.md"]);
    expect(result.totals).toEqual({ additions: 4, deletions: 1, fileCount: 2 });
    expect(runCalls.map((call) => call.cwd)).toEqual([
      "/repos/prompt-studio",
      "/repos/prompt-studio",
      "/repos/prompt-studio",
      "/repos/prompt-studio",
    ]);
  });
});
