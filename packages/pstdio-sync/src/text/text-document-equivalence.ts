import * as Y from "yjs";
import { characterId, characterKey, isDeletedCharacter, visibleCharacter } from "./text-document-characters";
import { ownTextDeletions, ownTextInsertions, rememberExactTextDeletions } from "./text-document-edits";
import {
  decodeCharacterMapping,
  encodeCharacterMapping,
  loadTextCheckpoint,
  saveTextReceipt,
  type TextAdoptionReceipt,
  textAdoptionsKey,
} from "./text-document-receipts";
import { readTextDocumentSeed } from "./text-document-seed";

interface CharacterNode {
  seed: string;
  id: Y.ID;
}
const nodeKey = (seed: string, id: Y.ID) => `${seed}/${characterKey(id)}`;

const createEquivalence = () => {
  const parents = new Map<string, string>();
  const nodes = new Map<string, CharacterNode>();
  const add = (seed: string, id: Y.ID) => {
    const key = nodeKey(seed, id);
    if (!parents.has(key)) {
      parents.set(key, key);
      nodes.set(key, { seed, id });
    }
    return key;
  };
  const find = (key: string) => {
    let root = key;
    while (parents.get(root) !== root) root = parents.get(root)!;
    while (key !== root) {
      const next = parents.get(key)!;
      parents.set(key, root);
      key = next;
    }
    return root;
  };
  return {
    nodes,
    add,
    find,
    join(left: string, right: string) {
      const first = find(left);
      const second = find(right);
      if (first !== second) parents.set(first, second);
    },
  };
};

const contextsFor = async (documents: Y.Doc[]) => {
  const contexts: Array<{
    seed: string;
    document: Y.Doc;
    genesis: Map<number, number>;
    inserted: ReturnType<typeof ownTextInsertions>;
    deleted: ReturnType<typeof ownTextDeletions>;
    temporary: boolean;
  }> = [];
  const queued = documents.map((document) => ({
    document,
    temporary: false,
    expected: undefined as string | undefined,
  }));
  const loaded = new Set<string>();
  try {
    for (const item of queued) {
      const seed = await readTextDocumentSeed(item.document);
      if (item.expected && item.expected !== seed.id) throw new Error("Adoption receipt has another source history");
      contexts.push({
        seed: seed.id,
        document: item.document,
        genesis: Y.decodeStateVector(Y.encodeStateVectorFromUpdate(seed.state)),
        inserted: ownTextInsertions(item.document),
        deleted: ownTextDeletions(item.document),
        temporary: item.temporary,
      });
      for (const [expected, receipt] of item.document.getMap<TextAdoptionReceipt>(textAdoptionsKey)) {
        if (loaded.has(receipt.state)) continue;
        loaded.add(receipt.state);
        queued.push({ document: loadTextCheckpoint(receipt.state), temporary: true, expected });
      }
    }
    return contexts;
  } catch (error) {
    for (const item of queued) if (item.temporary) item.document.destroy();
    throw error;
  }
};

const graphFor = (
  contexts: Awaited<ReturnType<typeof contextsFor>>,
  seed: string,
  pairs: Array<[Y.ID, Y.ID]>,
  deleted: Y.ID[],
) => {
  const graph = createEquivalence();
  const genesis = new Map(contexts.map((context) => [context.seed, context.genesis]));
  for (const context of contexts)
    for (const [source, receipt] of context.document.getMap<TextAdoptionReceipt>(textAdoptionsKey))
      for (const [key, target] of decodeCharacterMapping(receipt.mapping)) {
        if (!target) continue;
        const id = characterId(key);
        // Similar initial spelling is not shared character identity.
        if ((genesis.get(source)?.get(id.client) ?? 0) > id.clock) continue;
        graph.join(graph.add(source, id), graph.add(context.seed, target));
      }
  for (const [left, right] of pairs) graph.join(graph.add(seed, left), graph.add(seed, right));
  for (const id of deleted) graph.add(seed, id);
  return graph;
};

const selectCanonical = (
  ids: Y.ID[],
  contexts: Awaited<ReturnType<typeof contextsFor>>,
  remote: Y.Doc,
  seed: string,
) => {
  const canonical = contexts.filter((context) => context.seed === seed);
  const rank = (id: Y.ID) => {
    if (canonical.some((context) => context.inserted(id))) return 0;
    if (visibleCharacter(remote.getText("content"), id) !== undefined) return 1;
    return 2;
  };
  return [...ids].sort(
    (left, right) => rank(left) - rank(right) || left.client - right.client || left.clock - right.clock,
  )[0]!;
};

const restoreVisibleCharacter = (
  nodes: CharacterNode[],
  contexts: Awaited<ReturnType<typeof contextsFor>>,
  target: Y.Text,
  anchors: Y.ID[],
) => {
  for (const node of nodes)
    for (const context of contexts) {
      if (context.seed !== node.seed) continue;
      const source = context.document.getText("content");
      const index = visibleCharacter(source, node.id);
      if (index === undefined) continue;
      const anchor = anchors[0];
      const absolute = anchor
        ? Y.createAbsolutePositionFromRelativePosition(new Y.RelativePosition(null, "content", anchor, 0), target.doc!)
        : null;
      const position = absolute?.type === target ? absolute.index : target.length;
      target.insert(position, source.toString()[index]!);
      return Y.createRelativePositionFromTypeIndex(target, position).item!;
    }
  return null;
};

interface EquivalenceInput {
  local: Y.Doc;
  remote: Y.Doc;
  target: Y.Doc;
  seed: string;
  pairs: Array<[Y.ID, Y.ID]>;
  deleted: Y.ID[];
}

const resolveGroup = (
  nodes: CharacterNode[],
  contexts: Awaited<ReturnType<typeof contextsFor>>,
  input: EquivalenceInput,
  forced: Set<string>,
) => {
  const canonical = nodes.filter((node) => node.seed === input.seed).map((node) => node.id);
  if (!canonical.length) return null;
  const deleted = nodes.some(
    (node) =>
      forced.has(nodeKey(node.seed, node.id)) ||
      contexts.some(
        (context) =>
          context.seed === node.seed &&
          context.deleted(node.id) &&
          isDeletedCharacter(context.document.getText("content"), node.id),
      ),
  );
  const text = input.target.getText("content");
  const visible = canonical.filter((id) => visibleCharacter(text, id) !== undefined);
  let representative = selectCanonical(visible.length ? visible : canonical, contexts, input.remote, input.seed);
  if (!deleted && !visible.length)
    representative = restoreVisibleCharacter(nodes, contexts, text, canonical) ?? representative;
  for (const id of canonical) {
    if (!deleted && characterKey(id) === characterKey(representative)) continue;
    const index = visibleCharacter(text, id);
    if (index !== undefined) text.delete(index, 1);
  }
  return { canonical, representative, deleted };
};

const rewriteReceipts = (target: Y.Doc, aliases: Map<string, Y.ID>) => {
  for (const [seed, receipt] of target.getMap<TextAdoptionReceipt>(textAdoptionsKey)) {
    const mapping = decodeCharacterMapping(receipt.mapping);
    for (const [key, id] of mapping)
      if (id && aliases.has(characterKey(id))) mapping.set(key, aliases.get(characterKey(id))!);
    saveTextReceipt(target, seed, { ...receipt, mapping: encodeCharacterMapping(mapping) });
  }
};

/** Normalize the entire known identity class before removing any duplicate insertion. */
export const normalizeTextEquivalence = async (input: EquivalenceInput) => {
  const contexts = await contextsFor([input.local, input.remote, input.target]);
  try {
    const graph = graphFor(contexts, input.seed, input.pairs, input.deleted);
    const groups = new Map<string, CharacterNode[]>();
    for (const [key, node] of graph.nodes) {
      const root = graph.find(key);
      const group = groups.get(root) ?? [];
      group.push(node);
      groups.set(root, group);
    }
    const forced = new Set(input.deleted.map((id) => nodeKey(input.seed, id)));
    const aliases = new Map<string, Y.ID>();
    const normalizedDeletes: Y.ID[] = [];
    for (const nodes of groups.values()) {
      const result = resolveGroup(nodes, contexts, input, forced);
      if (!result) continue;
      for (const id of result.canonical) aliases.set(characterKey(id), result.representative);
      if (result.deleted) normalizedDeletes.push(result.representative);
    }
    rewriteReceipts(input.target, aliases);
    rememberExactTextDeletions(input.target, normalizedDeletes);
  } finally {
    for (const context of contexts) if (context.temporary) context.document.destroy();
  }
};
