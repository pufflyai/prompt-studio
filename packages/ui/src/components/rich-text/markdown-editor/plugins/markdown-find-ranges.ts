const textBlock = "p, h1, h2, h3, h4, h5, h6, li, td, th, pre, blockquote";

interface TextPart {
  node: Text;
  start: number;
  end: number;
}

const matchText = (text: string, query: string) => {
  const expression = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu");
  return text.matchAll(expression);
};

export const findMarkdownRanges = (root: HTMLElement, query: string) => {
  if (!query) return [];
  const result: Range[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let block: Element | null = null;
  let parts: TextPart[] = [];
  let text = "";
  const flush = () => {
    let firstPart = 0;
    let lastPart = 0;
    for (const match of matchText(text, query)) {
      const start = match.index;
      const end = start + match[0].length;
      while (parts[firstPart]!.end <= start) firstPart++;
      while (parts[lastPart]!.end < end) lastPart++;
      const first = parts[firstPart]!;
      const last = parts[lastPart]!;
      const range = root.ownerDocument.createRange();
      range.setStart(first.node, start - first.start);
      range.setEnd(last.node, end - last.start);
      result.push(range);
    }
    parts = [];
    text = "";
  };
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest("[hidden], [aria-hidden=true]") || !node.textContent) continue;
    const nextBlock = parent.closest(textBlock) ?? root;
    if (nextBlock !== block) flush();
    block = nextBlock;
    const start = text.length;
    text += node.textContent;
    parts.push({ node: node as Text, start, end: text.length });
  }
  flush();
  return result;
};

export const paintMarkdownRanges = (name: string, ranges: readonly Range[], priority = 0) => {
  if (!ranges.length || typeof Highlight === "undefined" || !CSS.highlights) return;
  const highlight = CSS.highlights.get(name) ?? new Highlight();
  highlight.priority = priority;
  for (const range of ranges) highlight.add(range);
  CSS.highlights.set(name, highlight);
  return () => {
    for (const range of ranges) highlight.delete(range);
    if (highlight.size === 0) CSS.highlights.delete(name);
  };
};

export const revealMarkdownRange = (range: Range) => {
  const firstRect = () => range.getClientRects()[0];
  for (let parent = range.startContainer.parentElement; parent; parent = parent.parentElement) {
    const rect = firstRect();
    if (!rect) return;
    const { overflowX, overflowY } = getComputedStyle(parent);
    const viewport = parent.getBoundingClientRect();
    if (/auto|scroll/.test(overflowY) && (rect.top < viewport.top || rect.bottom > viewport.bottom))
      parent.scrollTop += rect.top - viewport.top - parent.clientHeight / 2;
    if (/auto|scroll/.test(overflowX) && (rect.left < viewport.left || rect.right > viewport.right))
      parent.scrollLeft += rect.left - viewport.left - parent.clientWidth / 2;
  }
};
