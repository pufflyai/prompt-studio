/**
 * Checks that external sites linked from documentation, READMEs, extension docs, and skills still answer.
 * Remote availability changes without a commit, so this runs on a schedule (the Documentation links
 * workflow), never as a pull request check. Website docs and repository links on `main` are skipped:
 * docs-links.ts checks them offline.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractLinks } from "./docs-markdown";
import { checkedMarkdownFiles, indexRepository, REPOSITORY_MAIN_URL, SITE_DOCS_URL } from "./docs-repository";

// Hosts that only exist on a contributor's machine or in examples.
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|.*\.localhost|example\.(com|org|net))$/;
// Placeholders such as `https://github.com/<owner>/<repo>` are instructions, not links.
const PLACEHOLDER = /[<>{}$*]/;
const CONCURRENCY = 8;
const TIMEOUT_MS = 20_000;
// Sites answer these to bots or under load; a second request after a pause tells them apart from a dead link.
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
// Bot protection, such as on npmjs.com, refuses scripted requests to pages that work in a browser.
const BLOCKED_STATUSES = new Set([401, 403]);

export interface ExternalLinkResult {
  url: string;
  status: string;
  places: string[];
}

const isExternal = (url: string) => {
  if (!/^https?:\/\//.test(url) || PLACEHOLDER.test(url)) return false;
  if (SITE_DOCS_URL.test(url) || REPOSITORY_MAIN_URL.test(url)) return false;
  try {
    return !LOCAL_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

/** External URLs and the `file:line` places that link to each one. */
export const externalUrls = (documents: Array<{ file: string; text: string }>) => {
  const urls = new Map<string, string[]>();
  for (const { file, text } of documents) {
    for (const { url, line } of extractLinks(text).filter((link) => isExternal(link.url))) {
      urls.set(url, [...(urls.get(url) ?? []), `${file}:${line}`]);
    }
  }
  return urls;
};

const request = async (url: string, method: "HEAD" | "GET") => {
  try {
    const response = await fetch(url, { method, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
    await response.body?.cancel();
    return response.status;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

// Some servers reject HEAD, so a failed HEAD is confirmed with GET before it counts.
const probe = async (url: string) => {
  const head = await request(url, "HEAD");
  if (typeof head === "number" && head < 400) return undefined;
  const get = await request(url, "GET");
  return typeof get === "number" && get < 400 ? undefined : get;
};

const check = async (url: string) => {
  const first = await probe(url);
  if (first === undefined || (typeof first === "number" && !RETRY_STATUSES.has(first))) return first;
  await Bun.sleep(2_000);
  return probe(url);
};

/** Broken links, and links whose site refused a scripted request so they could not be verified. */
export const checkUrls = async (urls: Map<string, string[]>) => {
  const failures: ExternalLinkResult[] = [];
  const unverified: ExternalLinkResult[] = [];
  const queue = [...urls.keys()];
  const worker = async () => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      const result = await check(url);
      if (result === undefined) continue;
      const entry = { url, status: typeof result === "number" ? `HTTP ${result}` : result, places: urls.get(url)! };
      (typeof result === "number" && BLOCKED_STATUSES.has(result) ? unverified : failures).push(entry);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const byUrl = (a: ExternalLinkResult, b: ExternalLinkResult) => a.url.localeCompare(b.url);
  return { failures: failures.sort(byUrl), unverified: unverified.sort(byUrl) };
};

if (import.meta.main) {
  const root = join(import.meta.dir, "../..");
  const documents = checkedMarkdownFiles(indexRepository(root)).map((file) => ({
    file,
    text: readFileSync(join(root, file), "utf8"),
  }));
  const urls = externalUrls(documents);
  const { failures, unverified } = await checkUrls(urls);
  const lines = (results: ExternalLinkResult[]) =>
    results.map((result) => `- ${result.url} (${result.status}), linked from ${result.places.join(", ")}`);
  const summary = [
    "## External documentation links",
    `Checked ${urls.size} URLs. ${failures.length} failed. ${unverified.length} refused scripted requests.`,
    ...(failures.length > 0 ? ["", "### Failed", ...lines(failures)] : []),
    ...(unverified.length > 0 ? ["", "### Not verified: check these in a browser", ...lines(unverified)] : []),
  ];
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join("\n")}\n`);
  console.log(summary.join("\n"));
  if (failures.length > 0) process.exit(1);
}
