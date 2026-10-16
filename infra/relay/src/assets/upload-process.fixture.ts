import type { Scope } from "pstdio-sync-contracts";
import { type AssetConfig, createRelayAssets } from "./assets";
import { input, reference } from "./integration-fixture";

const config = JSON.parse(process.env.RELAY_ASSET_TEST_CONFIG!) as AssetConfig;
const scope = JSON.parse(process.env.RELAY_ASSET_TEST_SCOPE!) as Scope;
const assets = createRelayAssets(config);
if (process.env.RELAY_ASSET_TEST_ACTION === "part") {
  const bytes = new Uint8Array(5 * 1024 * 1024 + 32).fill(9);
  const upload = await assets.begin(scope, "crash-part", reference(bytes));
  await assets.writePart(scope, "crash-part", 1, input(bytes.subarray(0, upload.partSize)));
  console.log("part committed");
} else {
  await assets.finish(scope, "crash-finish");
  console.log("completion committed");
}
await new Promise(() => {});
