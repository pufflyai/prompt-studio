import { describe, expect, test } from "bun:test";
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { reportsCollection } from "../data/collections";
import { reportFilesDir, reportMarkdownPath } from "../data/draft-storage";
import { parseReportFrontmatter, stripFrontmatter } from "../data/frontmatter";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandContext } from "./command-context.fixture";
import { deleteReportCommand } from "./delete-report";
import { createMemoryRepoFiles } from "./repo-files.fixture";
import { saveReportCommand } from "./save-report";
import { writeReportCommand } from "./write-report";

const setup = () => ({
  storage: createMemoryStorage(),
  repoFiles: createMemoryRepoFiles(),
  events: [] as Array<{ event: string; payload: Record<string, unknown> }>,
});

const recordEvents = (events: Array<{ event: string; payload: Record<string, unknown> }>) => ({
  emit: async (event: unknown, payload: object) => {
    events.push({ event: String(event), payload: payload as Record<string, unknown> });
    return { delivered: 0 };
  },
});

const hashText = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const failBlobDeletes = (storage: ExtensionStorageApi): ExtensionStorageApi => ({
  ...storage,
  collection<TItem>(name: string) {
    const collection = storage.collection<TItem>(name);
    return {
      ...collection,
      attachments(itemId) {
        const blobs = collection.attachments(itemId);
        return {
          ...blobs,
          async delete(id) {
            await blobs.delete(id);
            throw new Error("blob cleanup failed");
          },
        };
      },
    };
  },
});

describe("report workflow", () => {
  test("write creates a workspace draft report with frontmatter", async () => {
    const { storage, repoFiles, events } = setup();
    repoFiles.files.set(".pstdio/config.json", new TextEncoder().encode(JSON.stringify({ workspace_id: "ws-1" })));

    const result = await writeReportCommand.run(
      makeCommandContext({
        storage,
        params: { kind: "review", source: "review-changes", template: "review" },
        overrides: {
          events: recordEvents(events),
          repoFiles,
          workspaces: {
            get: async () => ({ id: "ws-1", workspace_shorthand: "PS-116_A1" }),
          },
        },
      }),
    );

    expect(result).toEqual({
      workspace: "PS-116_A1",
      name: "review",
      path: reportMarkdownPath("review"),
      filesPath: reportFilesDir("review"),
    });

    const [report] = await reportsCollection(storage).list();
    expect(report).toMatchObject({
      workspaceShorthand: "PS-116_A1",
      workspaceId: "ws-1",
      name: "review",
      kind: "review",
      source: "review-changes",
      draft: true,
    });

    const markdown = new TextDecoder().decode(repoFiles.files.get(reportMarkdownPath("review"))!);
    expect(parseReportFrontmatter(markdown)).toMatchObject({
      reportName: "review",
      kind: "review",
      source: "review-changes",
      draft: true,
    });
    expect(stripFrontmatter(markdown)).toContain("## Confidence Score");
    expect(events).toHaveLength(1);
    expect(events[0]?.event).toBe("pstdio-reports.report.created");
  });

  test("write uses a selected registered report template", async () => {
    const { storage, repoFiles } = setup();

    await writeReportCommand.run(
      makeCommandContext({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", name: "pre-merge", template: "review" },
        overrides: {
          repoFiles,
          templates: {
            get: async (name) =>
              name === "review"
                ? {
                    id: "template-1",
                    project_id: "proj-1",
                    name: "review",
                    title: "Review report",
                    template_type: "report",
                    source_kind: "project",
                    is_default: false,
                    editable: true,
                    content: "# Review Template\n\nSelected body.",
                    created_at: "2026-01-01T00:00:00.000Z",
                    updated_at: "2026-01-01T00:00:00.000Z",
                    deleted_at: null,
                  }
                : null,
          },
        },
      }),
    );

    const markdown = new TextDecoder().decode(repoFiles.files.get(reportMarkdownPath("pre-merge"))!);
    expect(stripFrontmatter(markdown)).toContain("Selected body.");
  });

  test("write requires an explicit report template and lists the available templates", async () => {
    const { storage, repoFiles } = setup();

    await expect(
      writeReportCommand.run(
        makeCommandContext({
          storage,
          params: { workspace: "PS-116_A1", kind: "review" },
          overrides: { repoFiles },
        }),
      ),
    ).rejects.toThrow("Report template is required. Available templates: change-request, review");
  });

  test("write infers the workspace from the current worktree path when config has no workspace id", async () => {
    const { storage, repoFiles } = setup();
    const worktreePath = "/workspaces/PS-116_A1";
    repoFiles.files.set(".pstdio/config.json", new TextEncoder().encode(JSON.stringify({ project_id: "proj-1" })));

    const result = await writeReportCommand.run(
      makeCommandContext({
        storage,
        params: { kind: "review", template: "review" },
        overrides: {
          repo: { projectId: "proj-1", repoId: "repo-1", path: worktreePath },
          repoFiles,
          workspaces: {
            list: async () => [{ id: "ws-1", workspace_shorthand: "PS-116_A1", worktree_path: worktreePath }],
            get: async () => null,
          },
        },
      }),
    );

    expect(result.workspace).toBe("PS-116_A1");
    const [report] = await reportsCollection(storage).list();
    expect(report).toMatchObject({ workspaceId: "ws-1", workspaceShorthand: "PS-116_A1" });
  });

  test("write treats a malformed config as a missing workspace id and falls back to the worktree path", async () => {
    const { storage, repoFiles } = setup();
    const worktreePath = "/workspaces/PS-116_A1";
    repoFiles.files.set(".pstdio/config.json", new TextEncoder().encode("{ not valid json"));

    const result = await writeReportCommand.run(
      makeCommandContext({
        storage,
        params: { kind: "review", template: "review" },
        overrides: {
          repo: { projectId: "proj-1", repoId: "repo-1", path: worktreePath },
          repoFiles,
          workspaces: {
            list: async () => [{ id: "ws-1", workspace_shorthand: "PS-116_A1", worktree_path: worktreePath }],
            get: async () => null,
          },
        },
      }),
    );

    expect(result.workspace).toBe("PS-116_A1");
  });

  test("write increments the report file instead of reusing an existing report", async () => {
    const { storage, repoFiles, events } = setup();

    await writeReportCommand.run(
      makeCommandContext({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { repoFiles },
      }),
    );
    repoFiles.files.set(reportMarkdownPath("review"), new TextEncoder().encode("local edits"));

    const result = await writeReportCommand.run(
      makeCommandContext({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: {
          events: recordEvents(events),
          repoFiles,
        },
      }),
    );

    expect(result).toMatchObject({
      name: "review_01",
      path: ".pstdio/reports/review/report_01.md",
      filesPath: ".pstdio/reports/review/files_01",
    });
    expect(new TextDecoder().decode(repoFiles.files.get(reportMarkdownPath("review"))!)).toBe("local edits");
    expect(repoFiles.files.has(".pstdio/reports/review/report_01.md")).toBe(true);
    expect(await reportsCollection(storage).list()).toHaveLength(2);
    expect(events).toHaveLength(1);

    const third = await writeReportCommand.run(
      makeCommandContext({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { repoFiles },
      }),
    );

    expect(third).toMatchObject({
      name: "review_02",
      path: ".pstdio/reports/review/report_02.md",
      filesPath: ".pstdio/reports/review/files_02",
    });
  });

  test("write increments when an untracked report file already exists", async () => {
    const { storage, repoFiles } = setup();
    repoFiles.files.set(reportMarkdownPath("review"), new TextEncoder().encode("untracked review"));

    const result = await writeReportCommand.run(
      makeCommandContext({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { repoFiles },
      }),
    );

    expect(result).toMatchObject({
      name: "review_01",
      path: ".pstdio/reports/review/report_01.md",
      filesPath: ".pstdio/reports/review/files_01",
    });
    expect(new TextDecoder().decode(repoFiles.files.get(reportMarkdownPath("review"))!)).toBe("untracked review");
  });
});

describe("saved report workflow", () => {
  test("save and delete target a numbered report without changing the base report", async () => {
    const { storage, repoFiles } = setup();
    await writeReportCommand.run(
      makeCommandContext({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { repoFiles },
      }),
    );
    const numbered = await writeReportCommand.run(
      makeCommandContext({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { repoFiles },
      }),
    );
    repoFiles.files.set(numbered.path, new TextEncoder().encode("Numbered review"));

    await saveReportCommand.run(
      makeCommandContext({
        storage,
        params: { workspace: "PS-116_A1", name: numbered.name },
        overrides: { repoFiles },
      }),
    );
    await deleteReportCommand.run(
      makeCommandContext({
        storage,
        params: { workspace: "PS-116_A1", name: numbered.name },
        overrides: { repoFiles },
      }),
    );

    expect(repoFiles.files.has(reportMarkdownPath("review"))).toBe(true);
    expect(repoFiles.files.has(numbered.path)).toBe(false);
    expect((await reportsCollection(storage).list()).map((report) => report.name)).toEqual(["review"]);
  });

  test("save round-trips body, kind/source edits, and binary files", async () => {
    const { storage, repoFiles, events } = setup();
    await writeReportCommand.run(
      makeCommandContext({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { repoFiles },
      }),
    );

    repoFiles.files.set(
      reportMarkdownPath("review"),
      new TextEncoder().encode(
        [
          "---",
          'report_name: "ignored-rename"',
          'kind: "validation"',
          'source: "manual"',
          'created: "1999-01-01T00:00:00.000Z"',
          "draft: true",
          "---",
          "",
          "# Saved report",
          "",
          "Body text.",
        ].join("\n"),
      ),
    );
    repoFiles.files.set(`${reportFilesDir("review")}/screenshot.png`, new Uint8Array([137, 80, 78, 71]));

    const result = await saveReportCommand.run(
      makeCommandContext({
        storage,
        params: { workspace: "PS-116_A1", name: "review" },
        overrides: {
          events: recordEvents(events),
          repoFiles,
        },
      }),
    );

    expect(result).toEqual({ workspace: "PS-116_A1", name: "review", files: 1 });

    const [saved] = await reportsCollection(storage).list();
    expect(saved).toMatchObject({
      name: "review",
      kind: "validation",
      source: "manual",
      draft: false,
    });
    expect(saved.body).toContain("Body text.");
    expect(saved.createdAt).not.toBe("1999-01-01T00:00:00.000Z");
    expect(saved.files[0]).toMatchObject({ name: "screenshot.png", size: 4, hash: expect.any(String) });
    expect(saved.files[0]?.hash).not.toBe("");
    expect(
      parseReportFrontmatter(new TextDecoder().decode(repoFiles.files.get(reportMarkdownPath("review"))!)),
    ).toMatchObject({
      reportName: "review",
      draft: false,
    });
    expect(await reportsCollection(storage).attachments(saved.id).getBytes(saved.files[0]!.blobId)).toEqual(
      new Uint8Array([137, 80, 78, 71]),
    );
    expect(events[0]?.event).toBe("pstdio-reports.report.saved");
  });

  test("save succeeds when old attachment cleanup fails after storage update", async () => {
    const { storage, repoFiles } = setup();
    await writeReportCommand.run(
      makeCommandContext({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { repoFiles },
      }),
    );
    repoFiles.files.set(`${reportFilesDir("review")}/first.txt`, new TextEncoder().encode("first"));
    await saveReportCommand.run(
      makeCommandContext({ storage, params: { workspace: "PS-116_A1", name: "review" }, overrides: { repoFiles } }),
    );

    repoFiles.files.set(`${reportFilesDir("review")}/first.txt`, new TextEncoder().encode("second"));

    await expect(
      saveReportCommand.run(
        makeCommandContext({
          storage: failBlobDeletes(storage),
          params: { workspace: "PS-116_A1", name: "review" },
          overrides: { repoFiles },
        }),
      ),
    ).resolves.toEqual({ workspace: "PS-116_A1", name: "review", files: 1 });

    const [saved] = await reportsCollection(storage).list();
    expect(saved.files[0]?.hash).toBe(await hashText("second"));
  });

  test("delete removes storage and local report directory", async () => {
    const { storage, repoFiles, events } = setup();
    await writeReportCommand.run(
      makeCommandContext({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { repoFiles },
      }),
    );

    await deleteReportCommand.run(
      makeCommandContext({
        storage,
        params: { workspace: "PS-116_A1", name: "review" },
        overrides: {
          events: recordEvents(events),
          repoFiles,
        },
      }),
    );

    expect(await reportsCollection(storage).list()).toEqual([]);
    expect([...repoFiles.files.keys()].filter((path) => path.startsWith(".pstdio/reports/review/"))).toEqual([]);
    expect(events[0]?.event).toBe("pstdio-reports.report.deleted");
  });

  test("delete removes the report even when attachment cleanup fails", async () => {
    const { storage, repoFiles } = setup();
    await writeReportCommand.run(
      makeCommandContext({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { repoFiles },
      }),
    );
    repoFiles.files.set(`${reportFilesDir("review")}/evidence.txt`, new TextEncoder().encode("details"));
    await saveReportCommand.run(
      makeCommandContext({ storage, params: { workspace: "PS-116_A1", name: "review" }, overrides: { repoFiles } }),
    );

    await expect(
      deleteReportCommand.run(
        makeCommandContext({
          storage: failBlobDeletes(storage),
          params: { workspace: "PS-116_A1", name: "review" },
          overrides: { repoFiles },
        }),
      ),
    ).resolves.toEqual({ workspace: "PS-116_A1", name: "review", deleted: true });

    expect(await reportsCollection(storage).list()).toEqual([]);
    expect([...repoFiles.files.keys()].filter((path) => path.startsWith(".pstdio/reports/review/"))).toEqual([]);
  });

  test("rejects unsafe workspace and report names", async () => {
    const { storage, repoFiles } = setup();

    await expect(
      writeReportCommand.run(
        makeCommandContext({
          storage,
          params: { workspace: "../x", kind: "review", template: "review" },
          overrides: { repoFiles },
        }),
      ),
    ).rejects.toThrow("Unsafe workspace");

    await expect(
      writeReportCommand.run(
        makeCommandContext({
          storage,
          params: { workspace: "PS-116_A1", kind: "review", name: "files", template: "review" },
          overrides: { repoFiles },
        }),
      ),
    ).rejects.toThrow("Unsafe report name");
  });
});
