// GitHub rejects a release whose body is longer than 125,000 characters (HTTP 422).
export const releaseBodyLimit = 125_000;

/**
 * Builds a release body GitHub accepts. The changelog notes always lead. GitHub's generated
 * pull request list follows when it fits; otherwise a compare link replaces it. Notes that
 * alone exceed the limit end at a line boundary and point to the compare view.
 */
export const fitReleaseBody = (notes: string, generated: string, compareUrl: string, limit = releaseBodyLimit) => {
  const head = notes.trimEnd();
  const full = `${head}\n\n${generated.trim()}\n`;
  if (generated.trim() && full.length <= limit) return full;
  const link = `\n\n**Full Changelog**: ${compareUrl}\n`;
  if (head.length + link.length <= limit) return `${head}${link}`;
  const cut = `\n\n_These notes are shortened to fit GitHub's release size limit._${link}`;
  const kept = head.slice(0, limit - cut.length);
  const lineEnd = kept.lastIndexOf("\n");
  return `${(lineEnd > 0 ? kept.slice(0, lineEnd) : kept).trimEnd()}${cut}`;
};

if (import.meta.main) {
  const [notesPath, generatedPath, compareUrl] = process.argv.slice(2);
  if (!notesPath || !generatedPath || !compareUrl)
    throw new Error("Usage: release-body.ts <notes-file> <generated-notes-file> <compare-url>");
  process.stdout.write(
    fitReleaseBody(await Bun.file(notesPath).text(), await Bun.file(generatedPath).text(), compareUrl),
  );
}
