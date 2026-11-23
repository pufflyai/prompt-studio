import { expect, test } from "bun:test";
import { expectRejection } from "../test-utils/expect-rejection";
import { createProjectWork, ProjectRemovalInProgress } from "./project-work";

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
  await expectRejection(work.run("project", async () => "rejected")).toThrow("removing");
  const drained = work.drain("project");
  mayContinue.resolve();
  expect(await admitted).toBe("saved");
  await drained;
});

test("an admitted writer cannot open a new command stream after project admission closes", async () => {
  const work = createProjectWork();
  const mayContinue = Promise.withResolvers<void>();
  const admitted = work.run("project", async () => {
    await mayContinue.promise;
    await expectRejection(
      work.run("project", async () => "stream opened", undefined, { cancelOnFreeze: true }),
    ).toBeInstanceOf(ProjectRemovalInProgress);
  });
  await Promise.resolve();
  work.freeze("project");
  mayContinue.resolve();
  await admitted;
  await work.drain("project");
});
