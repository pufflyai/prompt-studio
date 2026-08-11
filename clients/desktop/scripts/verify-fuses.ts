import { resolve } from "node:path";
import { verifyPackagedDesktopFuses } from "../src/release/release-fuses";

const desktopRoot = resolve(import.meta.dirname, "..");
const executablePath = await verifyPackagedDesktopFuses(desktopRoot, process.platform, process.arch);
process.stdout.write(`Desktop fuse policy verified for ${executablePath}\n`);
