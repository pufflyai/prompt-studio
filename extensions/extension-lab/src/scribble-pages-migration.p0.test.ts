import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { readExampleState } from "./example-state";
import { createScribbleDocument } from "./scribble-pages-state";
import { updateScribblePageFields } from "./scribble-pages-storage";
import { exampleDefaults } from "./state-defaults";

test("existing Scribble pages, content and order survive the page-record upgrade", async () => {
  const storage = createMemoryStorage();
  const document = createScribbleDocument(exampleDefaults.scribble, "existing").documents.at(-1)!;
  await storage.collection("examples:scribble").put(JSON.stringify(["contentById", "existing"]), {
    path: ["contentById", "existing"],
    value: "Keep this content",
  });
  await storage.records.commit({
    operationId: crypto.randomUUID(),
    edits: [
      {
        recordId: storage.records.id("scribble.pages"),
        shared: [
          {
            kind: "map.set",
            key: document.id,
            value: {
              document: { ...document, sections: [], tasks: [], title: "Existing page" },
              position: "000000001",
            },
          },
        ],
      },
    ],
  });
  const state = await readExampleState(storage, "scribble");
  expect(state.documents[0].title).toBe("Existing page");
  expect(state.contentById.existing).toBe("Keep this content");
  await updateScribblePageFields(storage, "existing", { title: "Renamed page" });
  expect((await readExampleState(storage, "scribble")).documents[0].title).toBe("Renamed page");
});
