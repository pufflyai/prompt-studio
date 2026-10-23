import { createInterface } from "node:readline";
import { createProcessSampler } from "./process-sampler";

/** The desktop owns the observer's lifetime. No work runs without a request on its private pipe. */
export const runProcessObserver = async () => {
  const sampler = await createProcessSampler();
  const lines = createInterface({ input: process.stdin });
  try {
    for await (const line of lines) {
      const pid = Number(line);
      if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error("Invalid process identity");
      const reading = await sampler.read(pid);
      process.stdout.write(`${JSON.stringify(reading)}\n`);
    }
  } finally {
    lines.close();
    sampler.close();
  }
};
