import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const MODULES_DIR = join(ROOT, "src", "modules");
const BASELINE_FILE = join(ROOT, "scripts", "module-isolation-baseline.json");
const IMPORT_RE = /from\s+["']@\/modules\/([^/"']+)/g;

type Baseline = Record<string, string[]>;

const collectFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
};

const moduleOf = (file: string) => {
  const rel = relative(MODULES_DIR, file);
  return rel.split("/")[0];
};

const collectViolations = () => {
  const result: Record<string, string[]> = {};

  for (const file of collectFiles(MODULES_DIR)) {
    const ownModule = moduleOf(file);
    const src = readFileSync(file, "utf8");
    const imported = new Set<string>();

    for (const m of src.matchAll(IMPORT_RE)) {
      const target = m[1]!;
      if (target === ownModule) continue;
      imported.add(target);
    }

    if (imported.size > 0) {
      const key = relative(ROOT, file).replaceAll("\\", "/");
      result[key] = [...imported].sort();
    }
  }

  return result;
};

const loadBaseline = (): Baseline => {
  if (!existsSync(BASELINE_FILE)) return {};
  return JSON.parse(readFileSync(BASELINE_FILE, "utf8")) as Baseline;
};

const diff = (current: Record<string, string[]>, baseline: Baseline) => {
  const added: { file: string; importedModule: string }[] = [];

  for (const [file, modules] of Object.entries(current)) {
    const allowed = new Set(baseline[file] ?? []);
    for (const module of modules) {
      if (!allowed.has(module)) {
        added.push({ file, importedModule: module });
      }
    }
  }

  return added;
};

const current = collectViolations();

if (process.argv.includes("--update-baseline")) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(BASELINE_FILE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Wrote baseline: ${Object.keys(current).length} files, ${Object.values(current).flat().length} edges.`);
  process.exit(0);
}

const baseline = loadBaseline();
const added = diff(current, baseline);

if (added.length === 0) {
  console.log("OK: no new cross-module imports.");
  process.exit(0);
}

console.error(`Found ${added.length} new cross-module import(s).`);
console.error("Cross-module contracts must live under src/shared/, not src/modules/<other>/.");
console.error("");
const grouped = new Map<string, string[]>();
for (const v of added) {
  const list = grouped.get(v.file) ?? [];
  list.push(v.importedModule);
  grouped.set(v.file, list);
}
for (const [file, modules] of grouped) {
  console.error(`  ${file}`);
  for (const m of modules) console.error(`    -> @/modules/${m}/...`);
}
console.error("");
console.error("If this import is genuinely intentional, refactor it into src/shared/.");
console.error("To intentionally accept new violations, regenerate the baseline:");
console.error("  bun scripts/check-module-isolation.ts --update-baseline");
process.exit(1);
