// Only content-derived import specifiers cross resolver processes. File reads,
// digests, package resolution and graph membership always belong to the caller.
const entries = new Map<string, { imports: string[]; size: number }>();
const maximumEntries = 12_288;
const maximumBytes = 4 * 1024 * 1024;
const keyPattern = /^(?:js|jsx|ts|tsx|css)\0(?:false|true)\0[a-f0-9]{64}$/;
let retainedBytes = 2;

export const cachedRuntimeModuleImports = (key: string) => entries.get(key)?.imports;

export const retainRuntimeModuleImports = (key: string, imports: string[]) => {
  if (entries.has(key)) return;
  const size = Buffer.byteLength(JSON.stringify([key, imports])) + 1;
  if (size + 2 > maximumBytes) return;
  while (entries.size >= maximumEntries || retainedBytes + size > maximumBytes) {
    const oldest = entries.keys().next().value!;
    retainedBytes -= entries.get(oldest)!.size;
    entries.delete(oldest);
  }
  entries.set(key, { imports, size });
  retainedBytes += size;
};

export const snapshotRuntimeModuleImports = (exclude: ReadonlySet<string> = new Set()) =>
  [...entries].filter(([key]) => !exclude.has(key)).map(([key, value]) => [key, value.imports] as const);

// A malformed optional cache is discarded as a whole. It must never change the
// outcome of an otherwise valid inspection, or partially poison later calls.
export const restoreRuntimeModuleImports = (input: unknown) => {
  const restored = new Set<string>();
  if (!Array.isArray(input) || input.length > maximumEntries) return restored;
  const valid: [string, string[]][] = [];
  let bytes = 2;
  let minimumBytes = 2;
  for (const entry of input) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== "string" ||
      entry[0].length > 80 ||
      !keyPattern.test(entry[0]) ||
      !Array.isArray(entry[1]) ||
      entry[1].length > maximumBytes / 3
    )
      return restored;
    minimumBytes += entry[0].length + 8;
    for (const specifier of entry[1]) {
      if (typeof specifier !== "string" || specifier.length > maximumBytes) return restored;
      minimumBytes += Buffer.byteLength(specifier) + 3;
      if (minimumBytes > maximumBytes) return restored;
    }
    bytes += Buffer.byteLength(JSON.stringify(entry)) + 1;
    if (bytes > maximumBytes) return restored;
    valid.push([entry[0], entry[1]]);
  }
  for (const [key, imports] of valid) {
    retainRuntimeModuleImports(key, [...imports]);
    restored.add(key);
  }
  return restored;
};
