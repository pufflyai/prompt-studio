import { relative, resolve } from "node:path";

const values = new Set([
  "--plan",
  "--file",
  "--files-from",
  "--scope",
  "--runner",
  "--priority",
  "--artifact",
  "--stage",
  "--base",
  "--out",
  "--job",
  "--shard",
  "--timings",
  "--lane",
  "--performance-family",
]);
const switches = new Set(["--list", "--prebuilt", "--changed"]);
export const parseTestOptions = (argv: string[]) => {
  const args: string[] = [];
  const files: string[] = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (arg === "--") continue;
    if (switches.has(arg)) {
      args.push(arg);
      continue;
    }
    const [flag, ...parts] = arg.split("=");
    if (values.has(flag!)) {
      const value = parts.length ? parts.join("=") : argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
      args.push(flag!, value);
      continue;
    }
    if (arg.startsWith("-")) throw new Error(`Unknown test option: ${arg}`);
    files.push(arg);
  }
  return { args, files };
};
export const resolveTestFile = (file: string, root: string, cwd: string, available: string[]) => {
  const path = file.replaceAll("\\", "/");
  const matches = (path: string) => available.some((file) => file === path || file.startsWith(`${path}/`));
  const resolved = matches(path) ? path : relative(root, resolve(cwd, file)).replaceAll("\\", "/");
  if (!matches(resolved)) throw new Error(`Unknown test file: ${file}`);
  return resolved;
};
