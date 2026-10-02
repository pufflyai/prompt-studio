export const normalizeSearchQuery = (query: string) => query.trim().toLocaleLowerCase();

/** Every case-insensitive match of the query in the text, as [start, end) ranges. */
export const findSearchRanges = (text: string, query: string) => {
  const needle = normalizeSearchQuery(query);
  const ranges: Array<[number, number]> = [];
  if (!needle) return ranges;
  const haystack = text.toLocaleLowerCase();
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    ranges.push([index, index + needle.length]);
    index = haystack.indexOf(needle, index + needle.length);
  }
  return ranges;
};

/** Search only looks at the text a view shows, which the caller collects per row. */
export const searchRows = <TRow>(rows: TRow[], query: string, textsOf: (row: TRow) => string[]) => {
  const needle = normalizeSearchQuery(query);
  if (!needle) return rows;
  return rows.filter((row) => textsOf(row).some((text) => text.toLocaleLowerCase().includes(needle)));
};
