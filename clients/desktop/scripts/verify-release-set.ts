import { resolve } from "node:path";
import { verifyDesktopReleaseSet } from "../src/release/release-artifacts";

const root = resolve(process.argv[2] ?? "out/release");
const result = verifyDesktopReleaseSet(root);
process.stdout.write(`Desktop release ${result.releaseTag} is complete at ${root}\n`);
