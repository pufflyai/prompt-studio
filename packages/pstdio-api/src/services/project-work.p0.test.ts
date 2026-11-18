import { expect, test } from "bun:test";
import { createProjectWork } from "./project-work";

test("closing admission drains work already owned by that project", async () => {
  const work = createProjectWork();
  const mayContinue = Promise.withResolvers<void>();
  const admitted = work.run("project", async (signal) => {
    await mayContinue.promise;
    expect(signal.aborted).toBe(false);
    return work.run("project", async () => "saved");
  });
  await Promise.resolve();
  work.freeze("project");
  await expect(work.run("project", async () => "rejected")).rejects.toThrow("removing");
  const drained = work.drain("project");
  mayContinue.resolve();
  expect(await admitted).toBe("saved");
  await drained;
});
