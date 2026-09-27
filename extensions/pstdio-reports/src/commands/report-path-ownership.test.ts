import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { reportsCollection } from "../data/collections";
import { reportDir, reportFilesDirFor, reportMarkdownPathFor } from "../data/draft-storage";
import { makeCommandArgs } from "./command-context.fixture";
import { deleteReportCommand } from "./delete-report";
import { writeReportCommand } from "./write-report";

test.each([
  "absent",
  "retained",
])("report names stay reserved across workspaces with a missing local draft and %s evidence", async (evidence) => {
  const keepEvidence = evidence === "retained";
  const storage = createMemoryStorage();
  const projectFiles = createMemoryRepoFiles();
  const first = await writeReportCommand.run(
    ...makeCommandArgs({
      storage,
      params: { workspace: "WS-1", kind: "review", template: "review" },
      overrides: { projectFiles },
    }),
  );
  const report = (await reportsCollection(storage).get(first.reportId))!;
  const evidencePath = `${reportFilesDirFor(report)}/log.txt`;
  if (keepEvidence) {
    await projectFiles.writeText(evidencePath, "Original evidence");
    await projectFiles.delete(reportMarkdownPathFor(report));
  } else {
    await projectFiles.delete(reportDir(report.directoryName!));
  }

  const second = await writeReportCommand.run(
    ...makeCommandArgs({
      storage,
      params: { workspace: "WS-2", kind: "review", template: "review" },
      overrides: { projectFiles },
    }),
  );

  expect(second.name).toBe("review_01");
  expect(second.path).not.toBe(first.path);
  expect(second.filesPath).not.toBe(first.filesPath);
  expect(await projectFiles.exists(reportMarkdownPathFor(report))).toBe(false);
  if (keepEvidence) expect(await projectFiles.readText(evidencePath)).toBe("Original evidence");
  expect((await reportsCollection(storage).list()).map((stored) => stored.name)).toEqual(["review", "review_01"]);
});

test("deleting a legacy duplicate report keeps shared paths until their last stored reference is removed", async () => {
  const storage = createMemoryStorage();
  const projectFiles = createMemoryRepoFiles();
  const first = await writeReportCommand.run(
    ...makeCommandArgs({
      storage,
      params: { workspace: "WS-1", kind: "review", template: "review" },
      overrides: { projectFiles },
    }),
  );
  const collection = reportsCollection(storage);
  const report = (await collection.get(first.reportId))!;
  const legacy = { ...report, id: "legacy-report", shorthand: "RP-2", workspaceShorthand: "WS-2" };
  await collection.put(legacy.id, legacy);
  const markdownPath = reportMarkdownPathFor(report);
  const evidencePath = `${reportFilesDirFor(report)}/log.txt`;
  const content = await projectFiles.readText(markdownPath);
  await projectFiles.writeText(evidencePath, "Shared evidence");

  await deleteReportCommand.run(
    ...makeCommandArgs({
      storage,
      params: { workspace: "WS-1", name: first.name },
      overrides: { projectFiles },
    }),
  );
  expect(await projectFiles.exists(markdownPath)).toBe(true);
  expect(await projectFiles.readText(markdownPath)).toBe(content);
  expect(await projectFiles.readText(evidencePath)).toBe("Shared evidence");
  expect(await collection.list()).toEqual([legacy]);

  await deleteReportCommand.run(
    ...makeCommandArgs({
      storage,
      params: { workspace: "WS-2", name: legacy.name },
      overrides: { projectFiles },
    }),
  );
  expect(await projectFiles.exists(markdownPath)).toBe(false);
  expect(await projectFiles.exists(evidencePath)).toBe(false);
  expect(await collection.list()).toEqual([]);
});
