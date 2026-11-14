// Executed from the trusted base. Candidate source is read as data, never imported or executed.
import { execFileSync } from "node:child_process";
import { approvedCatalog, sourceDigest, workloadSource } from "pstdio-benchmarks/writer";

const sha = process.env.CATALOG_CANDIDATE_SHA!;
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("Expected immutable candidate SHA");
execFileSync("git", ["fetch", "--no-tags", "origin", sha]);
const git = (args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const files = git(["ls-tree", "-r", "--name-only", sha]).trim().split("\n").filter(workloadSource);
const digest = sourceDigest(files.map((file) => [file, git(["show", `${sha}:${file}`])]));
const lock = JSON.parse(git(["show", `${sha}:packages/benchmarks/catalog.lock.json`]));
if (lock.revision !== 1 || lock.digest !== digest)
  throw new Error("Candidate changed the frozen workload without a matching reviewed contract");
console.log(await approvedCatalog(digest));
