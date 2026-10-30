import { resolve } from "node:path";
import { checkNativeBuildFreshness } from "./native-build-freshness";
import { generatedRoot, generateStoryCatalog } from "./story-catalog";

const buildCatalog = async () => {
  // Refresh source discovery first so new examples also invalidate the compiled catalog.
  await generateStoryCatalog();
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
