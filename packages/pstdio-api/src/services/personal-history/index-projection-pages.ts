import type { PersonalIndexAccepted } from "pstdio-db";
import {
  type createEncryptedManifestNodes,
  type OrderedIndexReference,
  readOrderedIndexReference,
} from "pstdio-sync/records";
import type { Json } from "pstdio-sync-contracts";
import type { RouteDeps } from "../../features/deps";
import { readPersonalIndexDelta } from "./index-entry";

type Nodes = ReturnType<typeof createEncryptedManifestNodes>;
type Index = RouteDeps["extensionStorageService"]["personalHistoryIndex"];
type Owner = Parameters<Index["sourcePosition"]>[0];
export const writeIndexProjection = async (nodes: Nodes, index: Index, owner: Owner, writerId: string) => {
  let after: { kind: string; deviceId: string; id: string } | undefined;
  let level: OrderedIndexReference[] = [];
  while (true) {
    const page = await index.sourcePage(owner, writerId, after);
    if (!page.length) break;
    level.push(await nodes.write({ format: "personal-index-page", version: 1, entries: page } as unknown as Json, []));
    after = page.at(-1)!.delta;
  }
  if (!level.length) return null;
  while (level.length > 1) {
    const next: OrderedIndexReference[] = [];
    for (let offset = 0; offset < level.length; offset += 128) {
      const children = level.slice(offset, offset + 128);
      next.push(
        await nodes.write({ format: "personal-index-branch", version: 1, children } as unknown as Json, children),
      );
    }
    level = next;
  }
  return level[0]!;
};
export async function* readIndexProjection(
  nodes: Nodes,
  root: OrderedIndexReference | null,
  writerId: string,
  accountId: string,
  through: number,
  visited = new Set<string>(),
  depth = 0,
): AsyncGenerator<PersonalIndexAccepted[]> {
  if (!root) return;
  if (depth > 16 || visited.has(root.blobId)) throw new Error("Repeated or excessive private index snapshot graph");
  visited.add(root.blobId);
  const value = (await nodes.read(root)) as {
    format?: unknown;
    version?: unknown;
    entries?: unknown;
    children?: unknown;
  };
  if (!value || value.version !== 1) throw new Error("Invalid private index snapshot page");
  if (value.format === "personal-index-branch") {
    if (
      !Array.isArray(value.children) ||
      value.children.length < 1 ||
      value.children.length > 128 ||
      Object.keys(value).length !== 3
    )
      throw new Error("Invalid private index snapshot branch");
    const children = value.children.map(readOrderedIndexReference);
    if (new Set(children.map((child) => child.blobId)).size !== children.length)
      throw new Error("Repeated private index snapshot child");
    await nodes.retain(root, children);
    for (const child of children)
      yield* readIndexProjection(nodes, child, writerId, accountId, through, visited, depth + 1);
    return;
  }
  if (
    value.format !== "personal-index-page" ||
    !Array.isArray(value.entries) ||
    value.entries.length < 1 ||
    value.entries.length > 100 ||
    Object.keys(value).length !== 3
  )
    throw new Error("Invalid private index snapshot leaf");
  const entries = value.entries.map((input) => {
    const row = input as PersonalIndexAccepted;
    if (
      !row ||
      typeof row.entryId !== "string" ||
      !row.entryId ||
      !Number.isSafeInteger(row.sequence) ||
      row.sequence < 1 ||
      row.sequence > through ||
      !Number.isSafeInteger(row.index) ||
      row.index < 0 ||
      row.index >= 100 ||
      Object.keys(row).length !== 4
    )
      throw new Error("Invalid private index snapshot extent");
    return { ...row, delta: readPersonalIndexDelta(row.delta as unknown as Json, writerId, accountId) };
  });
  await nodes.retain(root, []);
  yield entries;
}
