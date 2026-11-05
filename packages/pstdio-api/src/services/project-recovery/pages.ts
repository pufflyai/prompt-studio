import { z } from "zod";
import { type createRecoveryChunkStore, type RecoveryChunk, recoveryChunkSchema } from "./chunks";

const pathSchema = z
  .string()
  .min(1)
  .refine((path) => !path.includes("\0") && path.split("/").every((part) => part && part !== "." && part !== ".."));
const modeSchema = z.number().int().min(0).max(0o7777);
export const recoveryEntrySchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("directory"), path: pathSchema, mode: modeSchema }),
  z.strictObject({
    kind: z.literal("symlink"),
    path: pathSchema,
    mode: modeSchema,
    target: z
      .string()
      .min(1)
      .refine((text) => !text.includes("\0")),
  }),
  z.strictObject({
    kind: z.literal("file"),
    path: pathSchema,
    mode: modeSchema,
    size: z.number().int().nonnegative().safe(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    content: recoveryChunkSchema.nullable(),
  }),
]);
export type RecoveryEntry = z.infer<typeof recoveryEntrySchema>;
const exclusionSchema = z.strictObject({ path: pathSchema, rule: z.string().min(1) });
type Exclusion = z.infer<typeof exclusionSchema>;
const observationSchema = z.strictObject({
  path: pathSchema.or(z.literal("")),
  identity: z.array(z.string()).length(6),
});
type Observation = z.infer<typeof observationSchema>;
type PageKind = "inventory" | "file" | "exclusion" | "observation";

const pageItems = 128;
const pageBytes = 768 * 1024;
const header = { version: z.literal(1) };
const pageSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...header,
    kind: z.literal("observation-leaf"),
    observations: z.array(observationSchema).max(pageItems),
  }),
  z.strictObject({
    ...header,
    kind: z.literal("observation-branch"),
    children: z.array(recoveryChunkSchema).min(1).max(pageItems),
  }),
  z.strictObject({ ...header, kind: z.literal("exclusion-leaf"), paths: z.array(exclusionSchema).max(pageItems) }),
  z.strictObject({
    ...header,
    kind: z.literal("exclusion-branch"),
    children: z.array(recoveryChunkSchema).min(1).max(pageItems),
  }),
  z.strictObject({
    ...header,
    kind: z.literal("inventory-leaf"),
    entries: z.array(recoveryEntrySchema).max(pageItems),
  }),
  z.strictObject({
    ...header,
    kind: z.literal("inventory-branch"),
    children: z.array(recoveryChunkSchema).min(1).max(pageItems),
  }),
  z.strictObject({
    ...header,
    kind: z.literal("file-leaf"),
    parts: z.array(recoveryChunkSchema).min(1).max(pageItems),
  }),
  z.strictObject({
    ...header,
    kind: z.literal("file-branch"),
    children: z.array(recoveryChunkSchema).min(1).max(pageItems),
  }),
]);
type ChunkStore = Awaited<ReturnType<typeof createRecoveryChunkStore>>;
const encoder = new TextEncoder();

/** Each level retains at most one bounded page. Neither a file's chunk list nor
 * the folder inventory needs a project-sized array before its root is available. */
const pageWriter = <T>(chunks: ChunkStore, kind: PageKind) => {
  let values: T[] = [];
  let bytes = 128;
  let finished = false;
  const levels: RecoveryChunk[][] = [];
  const write = (value: unknown) => chunks.stage(encoder.encode(JSON.stringify(pageSchema.parse(value))));
  const branch = (children: RecoveryChunk[]) => write({ version: 1, kind: `${kind}-branch`, children });
  const append = async (level: number, reference: RecoveryChunk) => {
    while (true) {
      levels[level] ??= [];
      const pending = levels[level]!;
      pending.push(reference);
      if (pending.length < pageItems) return;
      reference = await branch(pending);
      levels[level] = [];
      level++;
    }
  };
  const flush = async () => {
    if (!values.length) return;
    const entries = {
      [{ inventory: "entries", file: "parts", exclusion: "paths", observation: "observations" }[kind]]: values,
    };
    await append(0, await write({ version: 1, kind: `${kind}-leaf`, ...entries }));
    values = [];
    bytes = 128;
  };
  return {
    async add(value: T) {
      if (finished) throw new Error("The recovery page writer is closed");
      const size = encoder.encode(JSON.stringify(value)).length + 1;
      if (size > pageBytes - 128) throw new Error("Recovery metadata exceeds one bounded page");
      if (values.length >= pageItems || bytes + size > pageBytes) await flush();
      values.push(value);
      bytes += size;
    },
    async finish() {
      if (finished) throw new Error("The recovery page writer is closed");
      finished = true;
      await flush();
      for (let level = 0; level < levels.length; level++) {
        const references = levels[level]!;
        if (!references.length) continue;
        const higher = levels.slice(level + 1).some((values) => values.length);
        if (!higher) return references.length === 1 ? references[0]! : branch(references);
        levels[level] = [];
        await append(level + 1, await branch(references));
      }
      if (kind === "file") return null;
      return write({
        version: 1,
        kind: `${kind}-leaf`,
        [{ inventory: "entries", exclusion: "paths", observation: "observations" }[kind]]: [],
      });
    },
  };
};

export const createRecoveryPages = (chunks: ChunkStore) => {
  const read = async (reference: RecoveryChunk) =>
    pageSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await chunks.read(reference))));
  async function* leaves(root: RecoveryChunk, kind: PageKind) {
    const stack: { reference: RecoveryChunk; depth: number; exit?: boolean }[] = [{ reference: root, depth: 0 }];
    const ancestors = new Set<string>();
    while (stack.length) {
      const current = stack.pop()!;
      const id = current.reference.blobId;
      if (current.exit) {
        ancestors.delete(id);
        continue;
      }
      if (current.depth > 64 || ancestors.has(id)) throw new Error("Invalid recovery page graph");
      const page = await read(current.reference);
      if (!page.kind.startsWith(`${kind}-`)) throw new Error("Recovery page has the wrong role");
      if (!("children" in page)) {
        yield page;
        continue;
      }
      ancestors.add(id);
      stack.push({ ...current, exit: true });
      for (const reference of [...page.children].reverse()) stack.push({ reference, depth: current.depth + 1 });
    }
  }
  return {
    read,
    inventory: () => {
      const writer = pageWriter<RecoveryEntry>(chunks, "inventory");
      return {
        ...writer,
        async finish() {
          const root = await writer.finish();
          if (!root) throw new Error("An inventory must retain its empty root");
          return root;
        },
      };
    },
    file: () => pageWriter<RecoveryChunk>(chunks, "file"),
    excluded: () => pageWriter<Exclusion>(chunks, "exclusion"),
    observations: () => pageWriter<Observation>(chunks, "observation"),
    async *observed(root: RecoveryChunk | null) {
      if (!root) return;
      for await (const page of leaves(root, "observation"))
        if (page.kind === "observation-leaf") for (const observation of page.observations) yield observation;
    },
    async *exclusions(root: RecoveryChunk | null) {
      if (!root) return;
      for await (const page of leaves(root, "exclusion"))
        if (page.kind === "exclusion-leaf") for (const path of page.paths) yield path;
    },
    async *entries(root: RecoveryChunk) {
      for await (const page of leaves(root, "inventory"))
        if (page.kind === "inventory-leaf") for (const entry of page.entries) yield entry;
    },
    async *parts(root: RecoveryChunk | null) {
      if (!root) return;
      for await (const page of leaves(root, "file"))
        if (page.kind === "file-leaf") for (const part of page.parts) yield part;
    },
  };
};
