import { runStapler } from "../src/release/stapler";

const [action, appPath] = process.argv.slice(2);
if ((action !== "staple" && action !== "validate") || !appPath) {
  throw new Error("usage: run-stapler.ts <staple|validate> <app-path>");
}
await runStapler(action, appPath);
