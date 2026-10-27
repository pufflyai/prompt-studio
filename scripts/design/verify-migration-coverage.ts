import { resolve } from "node:path";
import { checkNativeBuildFreshness } from "./native-build-freshness";
import { generatedRoot } from "./story-catalog";

const { manifest, stale } = await checkNativeBuildFreshness();
const ledger = await Bun.file(resolve(generatedRoot, "migration-ledger.json")).json();
const unmigrated = ledger.entries.filter((entry: { destination: unknown }) => !entry.destination);
console.log(
  JSON.stringify(
    {
      nativeSources: Object.keys(manifest.hashes).length,
      stale,
      stories: ledger.stories.length,
      documents: ledger.documents.length,
      designNodes: ledger.entries.length,
      unmigratedDesignNodes: unmigrated.length,
      designFreshness: ledger.designFreshness,
      ready: !stale.length && !unmigrated.length && ledger.designFreshness === "verified",
    },
    null,
    2,
  ),
);
if (stale.length || unmigrated.length || ledger.designFreshness !== "verified") process.exitCode = 1;
