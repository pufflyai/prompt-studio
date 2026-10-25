import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const decode = (value: string) =>
  value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number(entity.slice(1)));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[entity]!;
  });
const attribute = (source: string, name: string) => decode(source.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? "");

export const junitCases = (xml: string) => {
  const summary = xml.match(/<testsuites\b[^>]*>/)?.[0];
  if (!summary) throw new Error("Missing JUnit testsuites summary");
  const occurrences = new Map<string, number>();
  const cases = [...xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)].map((match) => {
    const attributes = match[1]!;
    const body = match[2] ?? "";
    const file = attribute(attributes, "file").replaceAll("\\", "/");
    const title = [attribute(attributes, "classname"), attribute(attributes, "name")].filter(Boolean).join(" > ");
    const line = Number(attribute(attributes, "line")) || null;
    const key = `${file}:${line ?? "?"}:${title}`;
    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    let outcome = "success";
    if (/<(?:failure|error)\b/.test(body)) outcome = "failure";
    else if (/<skipped\b/.test(body)) outcome = "skipped";
    return {
      id: `${key}#${occurrence}`,
      file,
      title,
      line,
      outcome,
      durationMs: Number(attribute(attributes, "time")) * 1000,
    };
  });
  if (Number(attribute(summary, "tests")) !== cases.length) throw new Error("Incomplete JUnit case report");
  return cases;
};

interface RegisteredCase {
  runner: string;
  file: string;
  name: string;
  platforms: string[];
  arch?: string;
}

export const registeredUnselectedScope = (
  root: string,
  cwd: string,
  args: string[],
  entries: RegisteredCase[],
  runner: string,
  reported: ReturnType<typeof junitCases>,
) => {
  if (
    !args.includes("--pass-with-no-tests") ||
    !reported.length ||
    reported.some((entry) => entry.outcome !== "skipped")
  )
    return null;
  const paths = args.filter((arg) => !arg.startsWith("-"));
  if (!paths.length || paths.some((path) => !/\.test\.tsx?$/.test(path))) return null;
  const files = [...new Set(paths.map((path) => relative(root, resolve(cwd, path)).replaceAll("\\", "/")))];
  const registered = entries.filter(
    (entry) =>
      entry.runner === runner &&
      files.includes(entry.file) &&
      entry.platforms.includes(process.platform) &&
      (!entry.arch || entry.arch === process.arch),
  );
  if (registered.length !== reported.length || files.some((file) => !reported.some((entry) => entry.file === file)))
    return null;
  if (
    registered.some(
      (entry) =>
        reported.filter(
          (item) => item.file === entry.file && (item.title === entry.name || item.title.endsWith(` > ${entry.name}`)),
        ).length !== 1,
    )
  )
    return null;
  return "Every explicitly scoped case belongs to the registered platform quarantine lane";
};

export const bunRunIdentity = (root: string) => ({
  sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  policyDigest: createHash("sha256")
    .update(readFileSync(`${root}/scripts/ci/test-policy.ts`))
    .digest("hex"),
  platform: process.platform,
  arch: process.arch,
  bun: Bun.version,
});
