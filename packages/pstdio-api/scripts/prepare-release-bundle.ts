import { join } from "node:path";
import { packageSha256 } from "pstdio-extensions/distribution";
import { installExtensionSource } from "../src/features/extensions/install-extension-source";
import { exportPreparedReleaseBundle } from "../src/features/extensions/prepared-release-bundle";

const [source, output] = Bun.argv.slice(2);
if (!source || !output || !process.env.PSTDIO_HOME)
  throw new Error("Bundle preparation requires a source archive, output folder, and isolated PSTDIO_HOME.");
const installed = await installExtensionSource({ source, repoPath: output });
if (!installed.preparedRevision) throw new Error("Extension preparation did not produce a runnable revision.");
const sourceSha256 = packageSha256(await Bun.file(source).bytes());
const artifact = await exportPreparedReleaseBundle(installed.preparedRevision, sourceSha256);
await Bun.write(join(output, "runtime.tgz"), artifact.bytes);
await Bun.write(join(output, "runtime.json"), JSON.stringify(artifact.descriptor));
