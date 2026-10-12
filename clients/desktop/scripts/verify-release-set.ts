import { resolve } from "node:path";
import { parseDesktopReleaseTarget, verifyDesktopReleaseSet } from "../src/release/release-artifacts";

const targetsIndex = process.argv.indexOf("--targets");
// Nightlies build a subset of targets; stable releases check the full matrix.
const targets =
  targetsIndex >= 0 ? process.argv[targetsIndex + 1]?.split(",").map(parseDesktopReleaseTarget) : undefined;
const root = resolve(process.argv[2] ?? "out/release");
const result = verifyDesktopReleaseSet(root, targets);
process.stdout.write(`Desktop release ${result.releaseTag} is complete at ${root}\n`);
