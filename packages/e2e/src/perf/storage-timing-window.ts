import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acquireTimingWindow,
  readTimingWindow,
  releaseTimingWindow,
  type TimingWindowInput,
} from "storage-scale-fixture";

const [action, inputPath] = process.argv.slice(2);
const path = process.env.PSTDIO_TIMING_LOCK_DIR ?? join(tmpdir(), "pstdio-exclusive-timing.lock");
if (action === "status") console.log(JSON.stringify(readTimingWindow(path)));
else if (action === "acquire" && inputPath) {
  const input = (await Bun.file(inputPath).json()) as TimingWindowInput;
  console.log(JSON.stringify(acquireTimingWindow(path, input)));
} else if (action === "release" && inputPath) {
  const owner = (await Bun.file(inputPath).json()) as { sessionId: string; token: string };
  console.log(JSON.stringify(releaseTimingWindow(path, owner.sessionId, owner.token)));
} else
  throw new Error(
    "Use acquire <acknowledgements.json>, status, or release <owner.json>; see performance reference 0005",
  );
