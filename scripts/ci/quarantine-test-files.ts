import { requestedTestFiles } from "./requested-test-files";
import { discoverTestFiles } from "./test-discovery";
import { quarantineRegistry } from "./test-quarantine";

export const selectedQuarantineRegistry = (root: string, args: string[]) => {
  if (!args.includes("--files-from")) return quarantineRegistry;
  const selected = new Set(requestedTestFiles(args, discoverTestFiles(root)));
  return quarantineRegistry.filter((entry) => selected.has(entry.file));
};
