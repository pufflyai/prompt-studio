import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import {
  artifactsCollection,
  createGlassLabArtifactCommand,
  deleteGlassLabArtifactCommand,
} from "./glass-lab-artifacts-command";

test("reports the removed Glass Lab artifact after deleting its record", async () => {
  const storage = createMemoryStorage();
  const artifact = await createGlassLabArtifactCommand.run(...makeCommandArgs({ storage, params: {} }));
  const removed: unknown[] = [];

  await deleteGlassLabArtifactCommand.run(
    ...makeCommandArgs({
      storage,
      params: { rowId: artifact.id },
      overrides: {
        resources: {
          removed: async (resource) => {
            expect(await artifactsCollection(storage).get(artifact.id)).toBeUndefined();
            removed.push(resource);
          },
        },
      },
    }),
  );

  expect(removed).toEqual([{ type: "glass-lab-artifact", id: artifact.id }]);
});
