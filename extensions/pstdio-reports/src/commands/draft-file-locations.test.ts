import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { reportsCollection } from "../data/collections";
import { reportMarkdownPath } from "../data/draft-storage";
import { makeCommandArgs } from "./command-context.fixture";
import { deleteReportCommand } from "./delete-report";
import { writeReportCommand } from "./write-report";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("report paths and creation events identify files in the default folder, independent of the selected workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "report-draft-location-"));
  roots.push(root);
  const storage = createMemoryStorage();
  const memory = createMemoryRepoFiles();
  const projectRoot = join(root, "project");
  const events: unknown[] = [];
  const projectFiles = {
    ...memory,
    async writeText(path: string, content: string) {
      await mkdir(dirname(join(projectRoot, path)), { recursive: true });
      await writeFile(join(projectRoot, path), content);
      await memory.writeText(path, content);
    },
  };
  const result = await writeReportCommand.run(
    ...makeCommandArgs({
      storage,
      params: { kind: "review", template: "review" },
      overrides: {
        workspaceId: "selected",
        projectFiles,
        events: {
          emit: async (_event, payload) => {
            events.push(payload);
            return { delivered: 0 };
          },
        },
        workspaces: {
          getDefault: async () => ({ id: "home", execution_kind: "local", root_path: projectRoot }),
          get: async () => ({ id: "selected", workspace_shorthand: "WS-1", execution_kind: "remote" }),
        },
      },
    }),
  );
  expect(result.path).toBe(join(projectRoot, reportMarkdownPath("review")));
  expect(result.filesPath).toBe(join(projectRoot, ".pstdio/reports/review/files"));
  expect(await readFile(result.path, "utf8")).toBe(await projectFiles.readText(reportMarkdownPath("review")));
  expect(events[0]).toMatchObject({ path: result.path, workspaceId: "selected" });
});

test("deleting a report preserves another workspace's draft and evidence in the shared directory", async () => {
  const storage = createMemoryStorage();
  const projectFiles = createMemoryRepoFiles();
  const overrides = {
    projectFiles,
    workspaces: {
      getDefault: async () => ({ id: "home", execution_kind: "local" as const, root_path: resolve("project") }),
    },
  };
  const first = await writeReportCommand.run(
    ...makeCommandArgs({ storage, params: { workspace: "WS-1", kind: "review", template: "review" }, overrides }),
  );
  const second = await writeReportCommand.run(
    ...makeCommandArgs({ storage, params: { workspace: "WS-2", kind: "review", template: "review" }, overrides }),
  );
  expect(second.name).toBe("review_01");
  const secondPath = ".pstdio/reports/review/report_01.md";
  const secondEvidence = ".pstdio/reports/review/files_01/log.txt";
  await projectFiles.writeText(secondEvidence, "Keep this evidence");
  const secondContent = await projectFiles.readText(secondPath);
  await deleteReportCommand.run(
    ...makeCommandArgs({ storage, params: { workspace: "WS-1", name: first.name }, overrides }),
  );
  expect(await projectFiles.exists(secondPath)).toBe(true);
  expect(await projectFiles.readText(secondPath)).toBe(secondContent);
  expect(await projectFiles.readText(secondEvidence)).toBe("Keep this evidence");
  expect((await reportsCollection(storage).list()).map((report) => report.id)).toEqual([second.reportId]);
});

test.each(["remote", "missing"])("report creation rejects a %s default target before changing data", async (target) => {
  const storage = createMemoryStorage();
  const projectFiles = createMemoryRepoFiles();
  await expect(
    writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "WS-1", kind: "review", template: "review" },
        overrides: {
          projectFiles,
          workspaces: {
            getDefault: async () =>
              target === "remote"
                ? { id: "home", execution_kind: "remote", root_path: resolve("stale-local-root") }
                : { id: "home", execution_kind: "local", root_path: null },
          },
        },
      }),
    ),
  ).rejects.toThrow("local project folder");
  expect(await reportsCollection(storage).list()).toEqual([]);
  expect(await projectFiles.list()).toEqual([]);
});
