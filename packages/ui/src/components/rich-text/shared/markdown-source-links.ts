import type { Link, LinkReference, Parent, RootContent } from "mdast";
import { parseMarkdownSource } from "./markdown-ast";

interface TextEdit {
  end: number;
  replacement: string;
  start: number;
}

interface LinkChanges {
  edits: TextEdit[];
  normalizedCurrent: string;
}

interface LinkOccurrence {
  block: RootContent;
  node: Link | LinkReference;
}

const nodeOffsets = (node: { position?: { start: { offset?: number }; end: { offset?: number } } }) => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? null : { end, start };
};

const isParent = (node: unknown): node is Parent =>
  typeof node === "object" && node !== null && "children" in node && Array.isArray(node.children);

const isLink = (node: unknown): node is Link | LinkReference =>
  typeof node === "object" &&
  node !== null &&
  "type" in node &&
  (node.type === "link" || node.type === "linkReference");

const linksIn = (node: unknown) => {
  const links: Array<Link | LinkReference> = [];

  if (!isParent(node)) return links;

  for (const child of node.children) {
    if (isLink(child)) links.push(child);
    if (isParent(child)) links.push(...linksIn(child));
  }

  return links;
};

const linkOccurrencesIn = (markdown: string) =>
  parseMarkdownSource(markdown).children.flatMap((block) =>
    block.type === "table" ? [] : linksIn(block).map((node) => ({ block, node })),
  );

const removedLinkReplacements = (
  baseline: string,
  current: string,
  sourceLinks: LinkOccurrence[],
  baselineBlock: RootContent,
  baselineLinks: Array<Link | LinkReference>,
  currentBlock: RootContent,
) => {
  const baselineBlockOffsets = nodeOffsets(baselineBlock);
  const currentBlockOffsets = nodeOffsets(currentBlock);
  if (!baselineBlockOffsets || !currentBlockOffsets) return [];

  const linkOffsets = baselineLinks.map(nodeOffsets);
  if (linkOffsets.some((offsets) => !offsets)) return [];

  const segments: string[] = [];
  let baselineOffset = baselineBlockOffsets.start;
  for (const offsets of linkOffsets) {
    if (!offsets) return [];
    segments.push(baseline.slice(baselineOffset, offsets.start));
    baselineOffset = offsets.end;
  }
  segments.push(baseline.slice(baselineOffset, baselineBlockOffsets.end));

  const currentBlockSource = current.slice(currentBlockOffsets.start, currentBlockOffsets.end);
  const firstSegment = segments[0] ?? "";
  if (!currentBlockSource.startsWith(firstSegment)) return [];

  const replacements: Array<{ end: number; start: number; value: string }> = [];
  let currentOffset = firstSegment.length;

  for (let index = 0; index < baselineLinks.length; index += 1) {
    const nextSegment = segments[index + 1] ?? "";
    const replacementEnd =
      index === baselineLinks.length - 1
        ? currentBlockSource.length - nextSegment.length
        : currentBlockSource.indexOf(nextSegment, currentOffset);
    if (replacementEnd < currentOffset) return [];

    replacements.push({
      start: currentOffset,
      end: replacementEnd,
      value: currentBlockSource.slice(currentOffset, replacementEnd),
    });
    currentOffset = replacementEnd + nextSegment.length;
  }

  if (currentOffset !== currentBlockSource.length) return [];

  return replacements.flatMap((replacement, index) => {
    if (linkOccurrencesIn(replacement.value).length > 0) return [];

    const sourceLinkOffsets = nodeOffsets(sourceLinks[index]?.node ?? {});
    const baselineLinkOffsets = linkOffsets[index];
    if (!sourceLinkOffsets || !baselineLinkOffsets) return [];

    return [
      {
        edit: { ...sourceLinkOffsets, replacement: replacement.value },
        normalization: {
          start: currentBlockOffsets.start + replacement.start,
          end: currentBlockOffsets.start + replacement.end,
          replacement: baseline.slice(baselineLinkOffsets.start, baselineLinkOffsets.end),
        },
      },
    ];
  });
};

const findRemovedLinkReplacements = (
  sourceLinks: LinkOccurrence[],
  baseline: string,
  current: string,
  baselineBlock: RootContent,
  baselineLinks: Array<Link | LinkReference>,
  currentBlocks: RootContent[],
  preferredBlockIndex: number,
  usedCurrentBlocks: Set<number>,
) => {
  const candidateIndexes = currentBlocks.map((_, index) => index);
  candidateIndexes.sort((left, right) => Number(right === preferredBlockIndex) - Number(left === preferredBlockIndex));

  for (const currentBlockIndex of candidateIndexes) {
    if (usedCurrentBlocks.has(currentBlockIndex)) continue;
    const currentBlock = currentBlocks[currentBlockIndex];
    if (!currentBlock) continue;

    const currentLinks = linksIn(currentBlock);
    if (baselineLinks.length <= currentLinks.length) continue;

    const replacements = removedLinkReplacements(
      baseline,
      current,
      sourceLinks,
      baselineBlock,
      baselineLinks,
      currentBlock,
    );
    if (replacements.length === baselineLinks.length - currentLinks.length) {
      return { currentBlockIndex, replacements };
    }
  }

  return null;
};

export const collectMarkdownLinkChanges = (source: string, baseline: string, current: string): LinkChanges => {
  const sourceLinks = linkOccurrencesIn(source);
  if (linkOccurrencesIn(current).length >= linkOccurrencesIn(baseline).length) {
    return { edits: [], normalizedCurrent: current };
  }

  const baselineTree = parseMarkdownSource(baseline);
  const currentTree = parseMarkdownSource(current);
  const edits: TextEdit[] = [];
  const normalizations: TextEdit[] = [];
  const usedCurrentBlocks = new Set<number>();
  let linkOrdinal = 0;

  for (let blockIndex = 0; blockIndex < baselineTree.children.length; blockIndex += 1) {
    const baselineBlock = baselineTree.children[blockIndex];
    if (!baselineBlock || baselineBlock.type === "table") continue;

    const baselineLinks = linksIn(baselineBlock);
    const linkChanges = findRemovedLinkReplacements(
      sourceLinks.slice(linkOrdinal, linkOrdinal + baselineLinks.length),
      baseline,
      current,
      baselineBlock,
      baselineLinks,
      currentTree.children,
      blockIndex,
      usedCurrentBlocks,
    );
    if (linkChanges) {
      for (const replacement of linkChanges.replacements) {
        edits.push(replacement.edit);
        normalizations.push(replacement.normalization);
      }
      usedCurrentBlocks.add(linkChanges.currentBlockIndex);
    }

    linkOrdinal += baselineLinks.length;
  }

  let normalizedCurrent = current;
  for (const normalization of normalizations.sort((left, right) => right.start - left.start)) {
    normalizedCurrent =
      normalizedCurrent.slice(0, normalization.start) +
      normalization.replacement +
      normalizedCurrent.slice(normalization.end);
  }

  return { edits, normalizedCurrent };
};
