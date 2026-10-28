import { generateMigrationLedger } from "./migration-ledger";
import { checkNativeBuildFreshness } from "./native-build-freshness";

const { manifest, stale } = await checkNativeBuildFreshness();
const ledger = await generateMigrationLedger();
console.log(
  JSON.stringify(
    {
      nativeSources: Object.keys(manifest.hashes).length,
      stale,
      variants: ledger.stories.length,
      documents: ledger.documents.length,
      originalExports: ledger.inventoriedStories.length,
      ready: !stale.length,
    },
    null,
    2,
  ),
);
if (stale.length) process.exitCode = 1;
