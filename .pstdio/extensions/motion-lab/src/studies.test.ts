import { expect, test } from "bun:test";
import { createMemoryRepoFiles } from "@pstdio/sdk/testing";
import { listStudies, readStudy } from "./studies";

const metadata = { title: "New study", group: "Workbench", description: "Example", duration: 6, canvas: "pane" };
test("discovers studies live, isolates invalid metadata, and hashes local dependencies", async () => {
  const files = createMemoryRepoFiles();
  await files.writeText("design/motion/studies/new-study/study.json", JSON.stringify(metadata));
  await files.writeText("design/motion/studies/new-study/scene.tsx", "export default () => null");
  const before = await readStudy(files, "new-study");
  expect(before.ok).toBe(true);
  await files.writeText("design/motion/studies/new-study/helper.ts", "export const changed=true");
  const after = await readStudy(files, "new-study");
  expect(after.ok && before.ok && after.hash !== before.hash).toBe(true);
  await files.writeText("design/motion/studies/broken/study.json", '{"duration":-1}');
  expect(await listStudies(files)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "new-study", ok: true }),
      expect.objectContaining({ id: "broken", ok: false, group: "Invalid" }),
    ]),
  );
  await files.delete("design/motion/studies/new-study");
  expect(await readStudy(files, "new-study")).toEqual({ ok: false, reason: "missing" });
});
test.each(["../outside", "UPPERCASE", "a/b"])("rejects invalid study ids: %s", async (id) => {
  expect(await readStudy(createMemoryRepoFiles(), id)).toMatchObject({ ok: false, reason: "invalid" });
});
