import { describe, expect, test } from "bun:test";
import { join, relative } from "node:path";
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { reportsCollection } from "../data/collections";
import { reportFilesDir, reportMarkdownPath } from "../data/draft-storage";
import { parseReportFrontmatter, stripFrontmatter } from "../data/frontmatter";
import { saveReportTemplate } from "../data/template-store";
import type { StoredReport } from "../data/types";
import { defaultProjectRoot, makeCommandArgs } from "./command-context.fixture";
import { deleteReportCommand } from "./delete-report";
import { readReportCommand } from "./read-report";
import { saveReportCommand } from "./save-report";
import { writeReportCommand } from "./write-report";

const setup = () => ({
  storage: createMemoryStorage(),
  projectFiles: createMemoryRepoFiles(),
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

/** Records every uploaded report file, and fails record writes or body uploads on request. */
const failingWrites = (storage: ExtensionStorageApi, fail: "record" | "body") => {
  const uploaded: { itemId: string; id: string }[] = [];
  const wrapped: ExtensionStorageApi = {
    ...storage,
    collection<TItem>(name: string) {
      const collection = storage.collection<TItem>(name);
      return {
        ...collection,
        async put(id: string, value: TItem) {
          if (fail === "record") throw new Error("record write failed");
          return collection.put(id, value);
        },
        attachments(itemId) {
          const blobs = collection.attachments(itemId);
          return {
            ...blobs,
            async put(input) {
              if (fail === "body" && input.name === "report.md") throw new Error("body upload failed");
              const blob = await blobs.put(input);
              uploaded.push({ itemId, id: blob.id });
              return blob;
            },
          };
        },
      };
    },
  };
  const remaining = async () => {
    const found = await Promise.all(
      uploaded.map(({ itemId, id }) => reportsCollection(storage).attachments(itemId).get(id)),
    );
    return found.filter(Boolean);
  };
  return { storage: wrapped, uploaded, remaining };
};

/** The first report read returns the record as it was before a later save replaced it. */
const readStaleReportOnce = (storage: ExtensionStorageApi, stale: StoredReport): ExtensionStorageApi => {
  let served = false;
  return {
    ...storage,
    collection<TItem>(name: string) {
      const collection = storage.collection<TItem>(name);
      return {
        ...collection,
        async get(id) {
          if (served) return collection.get(id);
          served = true;
          return stale as TItem;
        },
      };
    },
  };
};

describe("report workflow", () => {
  test("write creates a workspace draft report with frontmatter", async () => {
    const { storage, projectFiles, events } = setup();
    projectFiles.files.set(".pstdio/config.json", new TextEncoder().encode(JSON.stringify({ workspace_id: "stale" })));

    const result = await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { kind: "review", source: "review-changes", template: "review" },
        overrides: {
          events: recordEvents(events),
          projectFiles,
          workspaceId: "ws-1",
          workspaces: {
            get: async () => ({ id: "ws-1", workspace_shorthand: "PS-116_A1" }),
          },
        },
      }),
    );

    expect(result).toEqual({
      reportId: expect.any(String),
      shorthand: "RP-1",
      workspace: "PS-116_A1",
      name: "review",
      path: join(defaultProjectRoot, reportMarkdownPath("review")),
      filesPath: join(defaultProjectRoot, reportFilesDir("review")),
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

    const markdown = new TextDecoder().decode(projectFiles.files.get(reportMarkdownPath("review"))!);
    expect(parseReportFrontmatter(markdown)).toMatchObject({
      reportName: "review",
      kind: "review",
      source: "review-changes",
      draft: true,
    });
    expect(stripFrontmatter(markdown)).toContain("## Confidence Score");
    expect(events).toHaveLength(1);
    expect(events[0]?.event).toBe("pstdio-reports.report.created");
    expect(events[0]?.payload).toMatchObject({ reportId: report.id, workspaceId: "ws-1" });
  });

  test("write uses a selected registered report template", async () => {
    const { storage, projectFiles } = setup();
    const context = makeCommandArgs({ storage, params: {} })[0];
    await saveReportTemplate(context, {
      name: "review",
      title: "Review report",
      content: "# Review Template\n\nSelected body.",
    });

    await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", name: "pre-merge", template: "review" },
        overrides: { projectFiles },
      }),
    );

    const markdown = new TextDecoder().decode(projectFiles.files.get(reportMarkdownPath("pre-merge"))!);
    expect(stripFrontmatter(markdown)).toContain("Selected body.");
  });

  test("write requires an explicit report template and lists the available templates", async () => {
    const { storage, projectFiles } = setup();

    await expect(
      writeReportCommand.run(
        ...makeCommandArgs({
          storage,
          params: { workspace: "PS-116_A1", kind: "review" },
          overrides: { projectFiles },
        }),
      ),
    ).rejects.toThrow("Report template is required. Available templates: change-request, review");
  });

  test("write uses the default workspace when context has no workspace id", async () => {
    const { storage, projectFiles } = setup();
    const worktreePath = "/workspaces/PS-116_A1";
    projectFiles.files.set(".pstdio/config.json", new TextEncoder().encode(JSON.stringify({ project_id: "proj-1" })));

    const result = await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { kind: "review", template: "review" },
        overrides: {
          projectFiles,
          workspaces: {
            getDefault: async () => ({
              id: "ws-1",
              workspace_shorthand: "PS-116_A1",
              execution_kind: "local",
              root_path: worktreePath,
            }),
            get: async () => null,
          },
        },
      }),
    );

    expect(result.workspace).toBe("PS-116_A1");
    const [report] = await reportsCollection(storage).list();
    expect(report).toMatchObject({ workspaceId: "ws-1", workspaceShorthand: "PS-116_A1" });
  });

  test("write uses workspace context without reading host config", async () => {
    const { storage, projectFiles } = setup();
    const worktreePath = "/workspaces/PS-116_A1";
    projectFiles.files.set(".pstdio/config.json", new TextEncoder().encode("{ not valid json"));

    const result = await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { kind: "review", template: "review" },
        overrides: {
          projectFiles,
          workspaces: {
            getDefault: async () => ({
              id: "ws-1",
              workspace_shorthand: "PS-116_A1",
              execution_kind: "local",
              root_path: worktreePath,
            }),
            get: async () => null,
          },
        },
      }),
    );

    expect(result.workspace).toBe("PS-116_A1");
  });

  test("write increments the report file instead of reusing an existing report", async () => {
    const { storage, projectFiles, events } = setup();

    await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { projectFiles },
      }),
    );
    projectFiles.files.set(reportMarkdownPath("review"), new TextEncoder().encode("local edits"));

    const result = await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: {
          events: recordEvents(events),
          projectFiles,
        },
      }),
    );

    expect(result).toMatchObject({
      name: "review_01",
      path: join(defaultProjectRoot, ".pstdio/extension-storage/pstdio.pstdio-reports/reports/review/report_01.md"),
      filesPath: join(defaultProjectRoot, ".pstdio/extension-storage/pstdio.pstdio-reports/reports/review/files_01"),
    });
    expect(new TextDecoder().decode(projectFiles.files.get(reportMarkdownPath("review"))!)).toBe("local edits");
    expect(projectFiles.files.has(".pstdio/extension-storage/pstdio.pstdio-reports/reports/review/report_01.md")).toBe(
      true,
    );
    expect(await reportsCollection(storage).list()).toHaveLength(2);
    expect(events).toHaveLength(1);

    const third = await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { projectFiles },
      }),
    );

    expect(third).toMatchObject({
      name: "review_02",
      path: join(defaultProjectRoot, ".pstdio/extension-storage/pstdio.pstdio-reports/reports/review/report_02.md"),
      filesPath: join(defaultProjectRoot, ".pstdio/extension-storage/pstdio.pstdio-reports/reports/review/files_02"),
    });
  });

  test("write increments when an untracked report file already exists", async () => {
    const { storage, projectFiles } = setup();
    projectFiles.files.set(reportMarkdownPath("review"), new TextEncoder().encode("untracked review"));

    const result = await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { projectFiles },
      }),
    );

    expect(result).toMatchObject({
      name: "review_01",
      path: join(defaultProjectRoot, ".pstdio/extension-storage/pstdio.pstdio-reports/reports/review/report_01.md"),
      filesPath: join(defaultProjectRoot, ".pstdio/extension-storage/pstdio.pstdio-reports/reports/review/files_01"),
    });
    expect(new TextDecoder().decode(projectFiles.files.get(reportMarkdownPath("review"))!)).toBe("untracked review");
  });
});

describe("saved report workflow", () => {
  test("save and delete target a numbered report without changing the base report", async () => {
    const { storage, projectFiles } = setup();
    await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { projectFiles },
      }),
    );
    const numbered = await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { projectFiles },
      }),
    );
    projectFiles.files.set(
      relative(defaultProjectRoot, numbered.path).replaceAll("\\", "/"),
      new TextEncoder().encode("Numbered review"),
    );

    await saveReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", name: numbered.name },
        overrides: { projectFiles },
      }),
    );
    await deleteReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", name: numbered.name },
        overrides: { projectFiles },
      }),
    );

    expect(projectFiles.files.has(reportMarkdownPath("review"))).toBe(true);
    expect(projectFiles.files.has(relative(defaultProjectRoot, numbered.path).replaceAll("\\", "/"))).toBe(false);
    expect((await reportsCollection(storage).list()).map((report) => report.name)).toEqual(["review"]);
  });

  test("save round-trips body, kind/source edits, and binary files", async () => {
    const { storage, projectFiles, events } = setup();
    await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { projectFiles },
      }),
    );

    projectFiles.files.set(
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
    projectFiles.files.set(`${reportFilesDir("review")}/screenshot.png`, new Uint8Array([137, 80, 78, 71]));

    const result = await saveReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", name: "review" },
        overrides: {
          events: recordEvents(events),
          projectFiles,
        },
      }),
    );

    expect(result).toEqual({ reportId: expect.any(String), workspace: "PS-116_A1", name: "review", files: 1 });

    const [saved] = await reportsCollection(storage).list();
    expect(saved).toMatchObject({
      name: "review",
      kind: "validation",
      source: "manual",
      draft: false,
    });
    expect(await readReportCommand.run(...makeCommandArgs({ storage, params: { id: saved.id } }))).toMatchObject({
      body: expect.stringContaining("Body text."),
    });
    expect(saved.createdAt).not.toBe("1999-01-01T00:00:00.000Z");
    expect(saved.files[0]).toMatchObject({ name: "screenshot.png", size: 4, hash: expect.any(String) });
    expect(saved.files[0]?.hash).not.toBe("");
    expect(
      parseReportFrontmatter(new TextDecoder().decode(projectFiles.files.get(reportMarkdownPath("review"))!)),
    ).toMatchObject({
      reportName: "review",
      draft: false,
    });
    expect(await reportsCollection(storage).attachments(saved.id).getBytes(saved.files[0]!.blobId)).toEqual(
      new Uint8Array([137, 80, 78, 71]),
    );
    expect(events[0]?.event).toBe("pstdio-reports.report.saved");
    expect(events[0]?.payload).toMatchObject({ reportId: saved.id, workspaceId: saved.workspaceId });
  });
});

describe("saved report identity and failures", () => {
  test("reads a saved report by its stable id", async () => {
    const { storage, projectFiles } = setup();
    const written = await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { projectFiles },
      }),
    );
    await saveReportCommand.run(
      ...makeCommandArgs({ storage, params: { workspace: "PS-116_A1", name: "review" }, overrides: { projectFiles } }),
    );

    const report = await readReportCommand.run(...makeCommandArgs({ storage, params: { id: written.reportId } }));

    expect(report).toMatchObject({ id: written.reportId, workspaceShorthand: "PS-116_A1", draft: false });
  });

  test("a long report body is stored as a file and the report record stays small", async () => {
    const { storage, projectFiles } = setup();
    const written = await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { projectFiles },
      }),
    );
    // Over the 256 KiB record limit of extension API 0.3, like a report with pasted test logs.
    const log = "test output line\n".repeat(20_000);
    projectFiles.files.set(reportMarkdownPath("review"), new TextEncoder().encode(`# Review\n\n${log}`));
    await saveReportCommand.run(
      ...makeCommandArgs({ storage, params: { workspace: "PS-116_A1", name: "review" }, overrides: { projectFiles } }),
    );

    const [stored] = await reportsCollection(storage).list();
    expect(JSON.stringify(stored).length).toBeLessThan(10_000);
    const report = await readReportCommand.run(...makeCommandArgs({ storage, params: { id: written.reportId } }));
    expect(report).toMatchObject({ body: `# Review\n\n${log}` });
  });

  test("a draft whose report record cannot be written removes its body file", async () => {
    const { storage, projectFiles } = setup();
    const failing = failingWrites(storage, "record");

    await expect(
      writeReportCommand.run(
        ...makeCommandArgs({
          storage: failing.storage,
          params: { workspace: "PS-116_A1", kind: "review", template: "review" },
          overrides: { projectFiles },
        }),
      ),
    ).rejects.toThrow("record write failed");

    expect(failing.uploaded).toHaveLength(1);
    expect(await failing.remaining()).toEqual([]);
  });

  test("a save whose body upload fails removes the evidence it uploaded", async () => {
    const { storage, projectFiles } = setup();
    await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { projectFiles },
      }),
    );
    projectFiles.files.set(`${reportFilesDir("review")}/evidence.txt`, new TextEncoder().encode("details"));
    const failing = failingWrites(storage, "body");

    await expect(
      saveReportCommand.run(
        ...makeCommandArgs({
          storage: failing.storage,
          params: { workspace: "PS-116_A1", name: "review" },
          overrides: { projectFiles },
        }),
      ),
    ).rejects.toThrow("body upload failed");

    expect(failing.uploaded).toHaveLength(1);
    expect(await failing.remaining()).toEqual([]);
  });

  test("reading a report while a save replaces its body returns the saved body", async () => {
    const { storage, projectFiles } = setup();
    const written = await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { projectFiles },
      }),
    );
    const stale = (await reportsCollection(storage).get(written.reportId))!;
    projectFiles.files.set(reportMarkdownPath("review"), new TextEncoder().encode("# Review\n\nUpdated."));
    await saveReportCommand.run(
      ...makeCommandArgs({ storage, params: { workspace: "PS-116_A1", name: "review" }, overrides: { projectFiles } }),
    );

    const [ctx, params] = makeCommandArgs({ storage, params: { id: written.reportId } });
    const report = await readReportCommand.run({ ...ctx, storage: readStaleReportOnce(storage, stale) }, params);

    expect(report).toMatchObject({ body: "# Review\n\nUpdated." });
  });

  test("save succeeds when old attachment cleanup fails after storage update", async () => {
    const { storage, projectFiles } = setup();
    await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { projectFiles },
      }),
    );
    projectFiles.files.set(`${reportFilesDir("review")}/first.txt`, new TextEncoder().encode("first"));
    await saveReportCommand.run(
      ...makeCommandArgs({ storage, params: { workspace: "PS-116_A1", name: "review" }, overrides: { projectFiles } }),
    );

    projectFiles.files.set(`${reportFilesDir("review")}/first.txt`, new TextEncoder().encode("second"));

    await expect(
      saveReportCommand.run(
        ...makeCommandArgs({
          storage: failBlobDeletes(storage),
          params: { workspace: "PS-116_A1", name: "review" },
          overrides: { projectFiles },
        }),
      ),
    ).resolves.toMatchObject({ workspace: "PS-116_A1", name: "review", files: 1 });

    const [saved] = await reportsCollection(storage).list();
    expect(saved.files[0]?.hash).toBe(await hashText("second"));
  });

  test("delete removes storage and local report directory", async () => {
    const { storage, projectFiles, events } = setup();
    await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { projectFiles },
      }),
    );

    await deleteReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", name: "review" },
        overrides: {
          events: recordEvents(events),
          projectFiles,
        },
      }),
    );

    expect(await reportsCollection(storage).list()).toEqual([]);
    expect(
      [...projectFiles.files.keys()].filter((path) =>
        path.startsWith(".pstdio/extension-storage/pstdio.pstdio-reports/reports/review/"),
      ),
    ).toEqual([]);
    expect(events[0]?.event).toBe("pstdio-reports.report.deleted");
  });

  test("delete removes the report even when attachment cleanup fails", async () => {
    const { storage, projectFiles } = setup();
    await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { projectFiles },
      }),
    );
    projectFiles.files.set(`${reportFilesDir("review")}/evidence.txt`, new TextEncoder().encode("details"));
    await saveReportCommand.run(
      ...makeCommandArgs({ storage, params: { workspace: "PS-116_A1", name: "review" }, overrides: { projectFiles } }),
    );

    await expect(
      deleteReportCommand.run(
        ...makeCommandArgs({
          storage: failBlobDeletes(storage),
          params: { workspace: "PS-116_A1", name: "review" },
          overrides: { projectFiles },
        }),
      ),
    ).resolves.toEqual({ workspace: "PS-116_A1", name: "review", deleted: true });

    expect(await reportsCollection(storage).list()).toEqual([]);
    expect(
      [...projectFiles.files.keys()].filter((path) =>
        path.startsWith(".pstdio/extension-storage/pstdio.pstdio-reports/reports/review/"),
      ),
    ).toEqual([]);
  });

  test("rejects unsafe workspace and report names", async () => {
    const { storage, projectFiles } = setup();

    await expect(
      writeReportCommand.run(
        ...makeCommandArgs({
          storage,
          params: { workspace: "../x", kind: "review", template: "review" },
          overrides: { projectFiles },
        }),
      ),
    ).rejects.toThrow("Unsafe");

    await expect(
      writeReportCommand.run(
        ...makeCommandArgs({
          storage,
          params: { workspace: "PS-116_A1", kind: "review", name: "files", template: "review" },
          overrides: { projectFiles },
        }),
      ),
    ).rejects.toThrow("Unsafe report name");
  });
});
