import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { ScribbleDocument } from "./apps/scribble-data";
import { scribblePageEdit, scribblePageFields } from "./scribble-page-record";
import { applyStateChanges, type StateChange } from "./state-changes";
import { documentMarkdown, exampleDefaults } from "./state-defaults";

export const migrateScribblePages = (storage: ExtensionStorageApi) =>
  storage.migrate(1, async (_previous, migration) => {
    const changes = await storage.collection<StateChange>("examples:scribble").list();
    const old = await storage.records.read(storage.records.id("scribble.pages"));
    if (!changes.length && !old.exists) return;
    const state = applyStateChanges(
      exampleDefaults.scribble,
      changes.sort((a, b) => a.path.length - b.path.length),
    );
    const entries = Object.fromEntries(
      state.documents.map((document, index) => [
        document.id,
        {
          document,
          position: `${(index + 1).toString(16).padStart(8, "0")}1`,
        },
      ]),
    );
    if (old.shared?.kind === "map")
      Object.assign(
        entries,
        old.shared.value as unknown as Record<string, { document: ScribbleDocument; position: string }>,
      );
    // Retain the input so retrying the same migration operation cannot overwrite later page edits.
    await storage.records.commit({
      operationId: migration.id("scribble-page-records"),
      edits: Object.values(entries).map(({ document, position }) =>
        scribblePageEdit(
          storage,
          document.id,
          scribblePageFields(
            document,
            position,
            state.contentById[document.id] ?? documentMarkdown(document),
            state.favoriteIds.includes(document.id),
          ),
        ),
      ),
    });
  });
