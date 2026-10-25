const owners = new WeakMap<Document, { count: number; previous: string[] }>();

export const preventCanvasOverscroll = (document: Document) => {
  const elements = [document.documentElement, document.body];
  const entry = owners.get(document) ?? {
    count: 0,
    previous: elements.map((element) => element.style.overscrollBehaviorX),
  };
  if (!entry.count) {
    owners.set(document, entry);
    for (const element of elements) element.style.overscrollBehaviorX = "none";
  }
  entry.count += 1;
  return () => {
    entry.count -= 1;
    if (entry.count) return;
    for (const [index, element] of elements.entries()) element.style.overscrollBehaviorX = entry.previous[index];
    owners.delete(document);
  };
};
