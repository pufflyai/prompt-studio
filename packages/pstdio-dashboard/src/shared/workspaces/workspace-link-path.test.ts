import { expect, test } from "bun:test";
import { workspaceLinkPath } from "./workspace-link-path";

test("resolves relative and rooted paths against the source workspace only", () => {
  expect(workspaceLinkPath("src/../README.md", "/repo/a")).toBe("README.md");
  expect(workspaceLinkPath("/repo/a/src/app.ts", "/repo/a")).toBe("src/app.ts");
  for (const path of ["/repo/ab/app.ts", "/repo/b/src/app.ts", "../secret", "/repo/a/../secret"])
    expect(() => workspaceLinkPath(path, "/repo/a")).toThrow();
});

test("preserves Windows file case and requires the same path flavor and drive", () => {
  expect(workspaceLinkPath("c:/Repo/Source/App.ts", "C:\\Repo")).toBe("Source/App.ts");
  for (const path of ["D:/Repo/App.ts", "/Repo/App.ts", "C:/RepoOther/App.ts"])
    expect(() => workspaceLinkPath(path, "C:/Repo")).toThrow();
});
