import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { filesWithCopiedText, linesWithSeveralSentences, missingSentences } from "./legal-documents";

const root = resolve(import.meta.dir, "../..");
const site = join(root, "clients/landing-page");
const legalDirectory = join(site, "src/content/legal");
const failures: string[] = [];

const sourceFiles = async (directory: string) => {
  const entries = await readdir(directory, { recursive: true });
  const files = entries.filter((entry) => /\.(ts|tsx|astro|mjs)$/.test(entry));
  const contents = await Promise.all(files.map((file) => readFile(join(directory, file), "utf8")));
  return Object.fromEntries(files.map((file, index) => [relative(root, join(directory, file)), contents[index]]));
};

const documents = (await readdir(legalDirectory).catch(() => [])).filter((file) => file.endsWith(".md"));
if (documents.length === 0) {
  failures.push(
    `No legal documents in ${relative(root, legalDirectory)}. Legal pages must be written there in markdown.`,
  );
}

const sources = await sourceFiles(join(site, "src"));

for (const file of documents) {
  const name = basename(file, ".md");
  const path = relative(root, join(legalDirectory, file));
  const markdown = await readFile(join(legalDirectory, file), "utf8");

  for (const line of linesWithSeveralSentences(markdown)) {
    failures.push(`${path}:${line} holds more than one sentence. Put each sentence on its own line.`);
  }

  const page = join(site, "dist", name, "index.html");
  const html = await readFile(page, "utf8").catch(() => undefined);
  if (html === undefined) {
    failures.push(`${relative(root, page)} is missing. Build the landing page before this check.`);
  } else {
    for (const sentence of missingSentences(markdown, html)) {
      failures.push(`/${name}/ does not render this line of ${path}: "${sentence}"`);
    }
  }

  for (const copy of filesWithCopiedText(markdown, sources)) {
    failures.push(`${copy} copies text from ${path}. Legal text lives only in the markdown file.`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`Verified ${documents.length} legal documents.`);
