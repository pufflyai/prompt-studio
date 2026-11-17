import { afterEach, expect, test } from "bun:test";
import { Worker } from "node:worker_threads";
import { withBackgroundPreparation } from "pstdio-extensions";
import { createPreparationClient } from "pstdio-extensions/preparation-client";
import { createPreparationWatchRefresh } from "./preparation-watch-refresh";

const clients: ReturnType<typeof createPreparationClient>[] = [];
const owners: ReturnType<typeof createPreparationWatchRefresh>[] = [];
const gates: (() => void)[] = [];
afterEach(async () => {
  for (const release of gates.splice(0)) release();
  for (const owner of owners.splice(0)) await owner.dispose();
  for (const client of clients.splice(0)) await client.stop();
});
const fixture = () => {
  const client = createPreparationClient(
    () => new Worker(new URL("./preparation-watch-admission.fixture.ts", import.meta.url)),
  );
  clients.push(client);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  gates.push(release.resolve);
  return { client, entered, release };
};

test.each([
  { paths: ["a", "b"], expected: undefined },
  { paths: [undefined, "a"], expected: undefined },
  { paths: ["a", "a"], expected: "a" },
])("pending registrations merge paths without narrowing a full refresh: %j", async ({ paths, expected }) => {
  const { client, entered, release } = fixture();
  const observed: (string | undefined)[] = [];
  const owner = createPreparationWatchRefresh(async (path, signal) => {
    observed.push(path);
    if (observed.length === 1) {
      entered.resolve();
      await release.promise;
    }
    await client.run("value", { name: path }, { priority: "background", signal });
  });
  owners.push(owner);
  const first = owner.refresh("initial");
  await entered.promise;
  const pending = paths.map((path) => owner.refresh(path));
  release.resolve();
  await Promise.all([first, ...pending]);
  expect(observed).toEqual(["initial", expected]);
});

test("restoration lends its continuation across the running host gap and pending registration", async () => {
  const { client, entered, release } = fixture();
  const observed: string[] = [];
  const owner = createPreparationWatchRefresh(async (path, signal) => {
    if (path === "initial") {
      entered.resolve();
      await release.promise;
    }
    await client.run("value", { name: path }, { priority: "background", signal });
    observed.push(path!);
  });
  owners.push(owner);
  const first = withBackgroundPreparation(() => owner.refresh("initial"));
  await entered.promise;
  const restoration = client.withContinuation(() => owner.refresh("restore"), { priority: "restoration" });
  const unrelated = client
    .run("value", { name: "speculation" }, { priority: "background" })
    .then(() => observed.push("speculation"));
  release.resolve();
  await Promise.all([first, restoration, unrelated]);
  expect(observed).toEqual(["initial", "restore", "speculation"]);
});

test("a failed registration settles its callers and still drains an already requested pending generation", async () => {
  const { client, entered, release } = fixture();
  const observed: (string | undefined)[] = [];
  const owner = createPreparationWatchRefresh(async (path, signal) => {
    observed.push(path);
    if (path === "old") {
      entered.resolve();
      await release.promise;
      throw new Error("Source listing failed.");
    }
    await client.run("value", { name: path }, { priority: "background", signal });
  });
  owners.push(owner);
  const first = owner.refresh("old").catch((error) => error);
  await entered.promise;
  const next = owner.refresh("new");
  release.resolve();
  expect(await first).toMatchObject({ message: "Source listing failed." });
  await next;
  expect(observed).toEqual(["old", "new"]);
});

test("a completed generation settles its caller while a later registration remains pending", async () => {
  const { client, entered, release } = fixture();
  const later = Promise.withResolvers<void>();
  const releaseLater = Promise.withResolvers<void>();
  gates.push(releaseLater.resolve);
  const owner = createPreparationWatchRefresh(async (path, signal) => {
    if (path === "first") {
      entered.resolve();
      await release.promise;
    } else {
      later.resolve();
      await releaseLater.promise;
    }
    await client.run("value", { name: path }, { priority: "background", signal });
  });
  owners.push(owner);
  const first = owner.refresh("first");
  await entered.promise;
  const next = owner.refresh("later");
  release.resolve();
  await later.promise;
  await first;
  releaseLater.resolve();
  await next;
});

test("disposal closes pending registration and awaits the running owner without a late update", async () => {
  const { client, entered, release } = fixture();
  const observed: (string | undefined)[] = [];
  const owner = createPreparationWatchRefresh(async (path, signal) => {
    observed.push(path);
    entered.resolve();
    await release.promise;
    await client.run("value", { name: path }, { priority: "background", signal });
  });
  owners.push(owner);
  const first = owner.refresh("old").catch((error) => error);
  await entered.promise;
  const pending = owner.refresh("new");
  const closing = owner.dispose();
  release.resolve();
  await Promise.all([closing, pending]);
  expect(await first).toMatchObject({ message: "Extension watch registration stopped." });
  await owner.refresh("after disposal");
  expect(observed).toEqual(["old"]);
});
