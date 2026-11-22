import { expect, test } from "bun:test";
import { createDatabaseAdmission } from "./database-admission";

const step = (log: string[], name: string) => async () => {
  log.push(name);
};

test("core work overtakes queued extension work", async () => {
  const admission = createDatabaseAdmission();
  const log: string[] = [];
  const release = Promise.withResolvers<void>();
  const busy = admission.run("ext.a", () => release.promise);
  const queued = [
    admission.run("ext.a", step(log, "a1")),
    admission.run("ext.a", step(log, "a2")),
    admission.run(undefined, step(log, "core")),
  ];
  release.resolve();
  await Promise.all([busy, ...queued]);
  expect(log).toEqual(["core", "a1", "a2"]);
});

test("extensions take turns instead of draining one queue first", async () => {
  const admission = createDatabaseAdmission();
  const log: string[] = [];
  const release = Promise.withResolvers<void>();
  const busy = admission.run(undefined, () => release.promise);
  const queued = [
    ...["a1", "a2", "a3"].map((name) => admission.run("ext.a", step(log, name))),
    ...["b1", "b2"].map((name) => admission.run("ext.b", step(log, name))),
  ];
  release.resolve();
  await Promise.all([busy, ...queued]);
  expect(log).toEqual(["a1", "b1", "a2", "b2", "a3"]);
});

test("extension work keeps progressing while core work is queued", async () => {
  const admission = createDatabaseAdmission();
  const log: string[] = [];
  const release = Promise.withResolvers<void>();
  const busy = admission.run(undefined, () => release.promise);
  const queued = [
    admission.run("ext.a", step(log, "ext")),
    ...Array.from({ length: 10 }, (_, index) => admission.run(undefined, step(log, `core${index}`))),
  ];
  release.resolve();
  await Promise.all([busy, ...queued]);
  expect(log.indexOf("ext")).toBeGreaterThan(0);
  expect(log.indexOf("ext")).toBeLessThan(log.length - 1);
});

test("a long queue gives the event loop a turn between slices", async () => {
  const admission = createDatabaseAdmission({ sliceMs: 5 });
  let timerFiredAt = -1;
  let completed = 0;
  const spin = async () => {
    const until = performance.now() + 1;
    while (performance.now() < until);
    completed += 1;
  };
  setTimeout(() => {
    timerFiredAt = completed;
  }, 0);
  await Promise.all(Array.from({ length: 200 }, () => admission.run("ext.a", spin)));
  expect(timerFiredAt).toBeGreaterThan(0);
  expect(timerFiredAt).toBeLessThan(200);
});

test("failed work releases its turn and reports the failure to its caller", async () => {
  const admission = createDatabaseAdmission();
  const failure = admission.run("ext.a", async () => {
    throw new Error("constraint violated");
  });
  await expect(failure).rejects.toThrow("constraint violated");
  expect(await admission.run("ext.a", async () => "next")).toBe("next");
});
