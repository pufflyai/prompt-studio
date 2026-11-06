import { expect, test } from "bun:test";
import { createMemoryStorageDevices } from "@pstdio/sdk/testing";
import { readExampleState, writeExampleState } from "./example-state";
import { scribblePageEdit } from "./scribble-page-record";
import { readScribblePageEntries } from "./scribble-pages-storage";
import { exampleRecordId } from "./state-storage";

test("example changes and page fields use ordinary records while offline siblings survive", async () => {
  const pair = await createMemoryStorageDevices();
  const [first, second] = pair.devices;
  await writeExampleState(first, "pigeon", [{ path: ["draft", "subject"], value: "Before" }]);
  await pair.merge();
  await writeExampleState(first, "pigeon", [{ path: ["draft", "subject"], value: "After" }]);
  await writeExampleState(second, "pigeon", [{ path: ["draft", "to"], value: "alex@example.com" }]);
  await first.records.commit({
    operationId: "page",
    edits: [scribblePageEdit(first, "page", { title: "Saved page", position: "a1" })],
  });
  await pair.merge();
  for (const storage of pair.devices) {
    expect((await readExampleState(storage, "pigeon")).draft).toMatchObject({
      subject: "After",
      to: "alex@example.com",
    });
    expect((await storage.records.read(exampleRecordId(storage, "pigeon"))).shared).toBeNull();
    expect((await readScribblePageEntries(storage)).find((entry) => entry.document.id === "page")?.document.title).toBe(
      "Saved page",
    );
    expect((await storage.records.read(storage.records.id("scribble.page:page"))).value).toMatchObject({
      kind: "scribble.page",
      id: "page",
      title: "Saved page",
    });
  }
});
