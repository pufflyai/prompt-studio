import type { RecoveryChunk } from "./chunks";
import { type RecoveryChunkStore, readRecoveryManifest } from "./manifest";
import { createRecoveryPages } from "./pages";

type Role = "capture" | "inventory" | "exclusion" | "file" | "data";
interface Node {
  reference: RecoveryChunk;
  role: Role;
}

/** Child edges are authenticated inside encrypted pages. Their opaque IDs also
 * enter the relay's existing bounded reference graph for retention. */
export const walkRecoveryGraph = async (input: {
  chunks: RecoveryChunkStore;
  root: RecoveryChunk;
  signal?: AbortSignal;
  before?: (reference: RecoveryChunk) => Promise<void>;
  after?: (reference: RecoveryChunk, children: string[]) => Promise<void>;
}) => {
  const pages = createRecoveryPages(input.chunks);
  const childrenOf = async ({ reference, role }: Node) => {
    if (role === "data") return [];
    if (role === "capture") {
      const { capture } = await readRecoveryManifest(input.chunks, reference);
      const children: Node[] = [];
      for (const root of [capture, ...capture.git.dependencies]) {
        children.push({ reference: root.inventory, role: "inventory" });
        if (root.exclusions) children.push({ reference: root.exclusions, role: "exclusion" });
      }
      return children;
    }
    const page = await pages.read(reference);
    if (!page.kind.startsWith(`${role}-`)) throw new Error("Recovery page has the wrong role");
    if ("children" in page) return page.children.map((reference) => ({ reference, role }));
    if (page.kind === "inventory-leaf")
      return page.entries.flatMap<Node>((entry) =>
        entry.kind === "file" && entry.content ? [{ reference: entry.content, role: "file" }] : [],
      );
    if (page.kind === "file-leaf") return page.parts.map<Node>((reference) => ({ reference, role: "data" }));
    return [];
  };
  const ancestors = new Set<string>();
  const visit = async (node: Node, depth: number) => {
    input.signal?.throwIfAborted();
    if (depth > 64 || ancestors.has(node.reference.blobId)) throw new Error("Invalid recovery page graph");
    await input.before?.(node.reference);
    ancestors.add(node.reference.blobId);
    try {
      const children = await childrenOf(node);
      for (const child of children) await visit(child, depth + 1);
      input.signal?.throwIfAborted();
      await input.after?.(node.reference, [...new Set(children.map(({ reference }) => reference.blobId))]);
    } finally {
      ancestors.delete(node.reference.blobId);
    }
  };
  await visit({ reference: input.root, role: "capture" }, 0);
};
