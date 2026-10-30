import { resolve } from "node:path";
import { checkNativeBuildFreshness } from "./native-build-freshness";
import { generatedRoot, generateStoryCatalog } from "./story-catalog";

const buildCatalog = async () => {
  // Refresh source discovery first so new examples also invalidate the compiled catalog.
  await generateStoryCatalog();
  // The ledger is build output too: a clean checkout has no committed copy. It reads the
  // canvas definitions, which import the story catalog written above, so load it afterwards.
  const { generateMigrationLedger } = await import("./migration-ledger");
  await generateMigrationLedger();
  if (await Bun.file(resolve(generatedRoot, "native-manifest.json")).exists()) {
    const { stale } = await checkNativeBuildFreshness();
    if (!stale.length) {
      console.log("Canvas catalog is current.");
      return;
    }
  }
  await import("./build-native-previews");
};

await buildCatalog();
