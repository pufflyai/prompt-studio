export const normalizeReport = (report: string) =>
  `${report
    .replace(/\/\*\*[\s\S]*?\*\//g, (comment) => (comment.includes("@deprecated") ? "/** @deprecated */" : ""))
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.trimStart().startsWith("//"))
    .join("\n")}\n`;

export const changedApiEntries = (released: Map<string, string>, proposed: Map<string, string>) =>
  [...new Set([...released.keys(), ...proposed.keys()])]
    .filter((entry) => {
      const before = released.get(entry);
      const after = proposed.get(entry);
      return before === undefined || after === undefined || normalizeReport(before) !== normalizeReport(after);
    })
    .sort();
