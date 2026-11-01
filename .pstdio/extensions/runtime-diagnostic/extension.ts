import { Session } from "node:inspector";
import { setTimeout as delay } from "node:timers/promises";
import { defineCommand, defineExtension } from "@pstdio/sdk/extensions";
import { captureBytes } from "./byte-capture";

export default defineExtension({
  commands: [
    defineCommand({
      id: "bytes",
      title: "Trace large backend decodes",
      cli: true,
      async run(ctx) {
        const result = await captureBytes(10_000, ctx.signal);
        if (!ctx.extensionFiles) throw new Error("Diagnostic files are unavailable");
        await ctx.extensionFiles.writeText("backend-bytes.json", JSON.stringify(result));
        return { pid: result.pid, calls: result.calls, bytes: result.bytes, large: result.large.length };
      },
    }),
    defineCommand({
      id: "coverage",
      title: "Count backend operations",
      cli: true,
      async run(ctx) {
        const session = new Session();
        session.connect();
        const post = (method: string, params = {}) =>
          new Promise<unknown>((resolve, reject) => {
            session.post(method, params, (error, value) => (error ? reject(error) : resolve(value)));
          });
        try {
          await post("Profiler.enable");
          await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
          await delay(10_000, undefined, { signal: ctx.signal });
          const result = await post("Profiler.takePreciseCoverage");
          await post("Profiler.stopPreciseCoverage");
          if (!ctx.extensionFiles) throw new Error("Diagnostic files are unavailable");
          await ctx.extensionFiles.writeText("backend-coverage.json", JSON.stringify(result));
          return { pid: process.pid, file: "backend-coverage.json" };
        } finally {
          session.disconnect();
        }
      },
    }),
    defineCommand({
      id: "capture",
      title: "Capture backend CPU",
      cli: true,
      async run(ctx) {
        const session = new Session();
        session.connect();
        const post = (method: string) =>
          new Promise<unknown>((resolve, reject) => {
            session.post(method, (error, value) => (error ? reject(error) : resolve(value)));
          });
        const before = process.memoryUsage();
        try {
          await post("Profiler.enable");
          await post("Profiler.start");
          await delay(15_000, undefined, { signal: ctx.signal });
          const result = await post("Profiler.stop");
          if (!ctx.extensionFiles) throw new Error("Diagnostic files are unavailable");
          await ctx.extensionFiles.writeText("backend-profile.json", JSON.stringify(result));
          return { pid: process.pid, before, after: process.memoryUsage(), file: "backend-profile.json" };
        } finally {
          session.disconnect();
        }
      },
    }),
  ],
});
