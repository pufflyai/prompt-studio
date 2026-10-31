import { readFileSync } from "node:fs";

export const requestedTestFiles = (args: string[], available: string[]) => {
  const at = args.indexOf("--files-from");
  if (at < 0) return available;
  if (!args[at + 1]) throw new Error("Missing test selection file");
  const requested: unknown = JSON.parse(readFileSync(args[at + 1]!, "utf8"));
  if (
    !Array.isArray(requested) ||
    !requested.length ||
    requested.some((file) => typeof file !== "string" || !available.includes(file))
  )
    throw new Error("Requested tests must be nonempty discovered repository test paths");
  return [...new Set(requested)] as string[];
};
