import { describe, expect, test } from "bun:test";
import { resolveFolderPickerDefaultPath, resolveParentPath } from "./folder-picker-default-path";

interface DirectorySnapshot {
  currentPath: string;
  entries: Array<{ name: string }>;
}

const createLoader = (snapshots: Record<string, DirectorySnapshot>, calls: Array<string | undefined>) => {
  return async (path?: string) => {
    calls.push(path);
    const key = path ?? "__cwd__";
    const snapshot = snapshots[key];

    if (!snapshot) {
      throw new Error(`Missing snapshot for key: ${key}`);
    }

    return snapshot;
  };
};

describe("resolveParentPath", () => {
  test("resolves parent path for nested unix paths", () => {
    expect(resolveParentPath("/Users/you/projects/prompt-studio")).toBe("/Users/you/projects");
  });

  test("keeps root path stable", () => {
    expect(resolveParentPath("/")).toBe("/");
  });
});

describe("resolveFolderPickerDefaultPath", () => {
  test("returns home alias when no git root exists in ancestor chain", async () => {
    const calls: Array<string | undefined> = [];
    const loadDirectory = createLoader(
      {
        __cwd__: { currentPath: "/work/sandbox", entries: [{ name: "tmp" }] },
        "/work": { currentPath: "/work", entries: [{ name: "sandbox" }] },
        "/": { currentPath: "/", entries: [{ name: "usr" }] },
      },
      calls,
    );

    const path = await resolveFolderPickerDefaultPath(loadDirectory);

    expect(path).toBe("~");
    expect(calls).toEqual([undefined, "/work", "/"]);
  });

  test("returns the parent folder when cwd is a git root", async () => {
    const calls: Array<string | undefined> = [];
    const loadDirectory = createLoader(
      {
        __cwd__: { currentPath: "/Users/you/projects/prompt-studio", entries: [{ name: ".git" }] },
      },
      calls,
    );

    const path = await resolveFolderPickerDefaultPath(loadDirectory);

    expect(path).toBe("/Users/you/projects");
    expect(calls).toEqual([undefined]);
  });

  test("returns the parent of the nearest git-root ancestor", async () => {
    const calls: Array<string | undefined> = [];
    const loadDirectory = createLoader(
      {
        __cwd__: {
          currentPath: "/Users/you/projects/prompt-studio/packages/pstdio-dashboard",
          entries: [{ name: "src" }],
        },
        "/Users/you/projects/prompt-studio/packages": {
          currentPath: "/Users/you/projects/prompt-studio/packages",
          entries: [{ name: "pstdio-dashboard" }],
        },
        "/Users/you/projects/prompt-studio": {
          currentPath: "/Users/you/projects/prompt-studio",
          entries: [{ name: ".git" }],
        },
      },
      calls,
    );

    const path = await resolveFolderPickerDefaultPath(loadDirectory);

    expect(path).toBe("/Users/you/projects");
    expect(calls).toEqual([
      undefined,
      "/Users/you/projects/prompt-studio/packages",
      "/Users/you/projects/prompt-studio",
    ]);
  });
});
