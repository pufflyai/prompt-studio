import { Session } from "node:inspector";
import { defineCommand, defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  commands: [
    defineCommand({
      id: "bytes",
      title: "Trace large backend decodes",
      cli: true,
      async run(ctx) {
        const original = Buffer.from;
        let calls = 0;
        let bytes = 0;
        const large: { bytes: number; stack?: string; transcript: boolean }[] = [];
        const sizes = new Map<number, { count: number; transcript: boolean }>();
        Buffer.from = function (this: typeof Buffer, ...args: unknown[]) {
          const result = Reflect.apply(original, this, args) as Buffer;
          const [value, encoding] = args;
          if (typeof value === "string" && encoding === "hex") {
            const size = value.length / 2;
            calls++;
            bytes += size;
            if (size > 100_000) {
              const transcript = result.subarray(0, 256).includes(Buffer.from("content"));
              const previous = sizes.get(size);
              sizes.set(size, { count: (previous?.count ?? 0) + 1, transcript });
              if (large.length < 25) large.push({ bytes: size, stack: new Error().stack, transcript });
            }
          }
          return result;
        } as typeof original;
        try {
          await Bun.sleep(10_000);
          Buffer.from = original;
          const result = { pid: process.pid, calls, bytes, large, sizes: [...sizes] };
          if (!ctx.extensionFiles) throw new Error("Diagnostic files are unavailable");
          await ctx.extensionFiles.writeText("backend-bytes.json", JSON.stringify(result));
          return { pid: process.pid, calls, bytes, large: large.length };
        } finally {
          Buffer.from = original;
        }
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
          await Bun.sleep(10_000);
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
          await Bun.sleep(15_000);
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
