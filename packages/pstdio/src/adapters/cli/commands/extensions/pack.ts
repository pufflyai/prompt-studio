import { resolve } from "node:path";
import { packExtension } from "pstdio-extensions/distribution";
import type { Arguments, Argv } from "yargs";

export const command = "pack [folder]";
export const describe = "Create an extension package to share or publish";
export const builder = (yargs: Argv) =>
  yargs
    .positional("folder", { type: "string", default: ".", describe: "Extension folder" })
    .option("out-dir", { type: "string", default: ".", describe: "Package output folder" });
export const handler = async (argv: Arguments<{ folder: string; "out-dir": string }>) => {
  const packed = await packExtension(resolve(argv.folder));
  const path = resolve(argv["out-dir"], packed.filename);
  await Bun.write(path, packed.bytes);
  console.log(path);
};
