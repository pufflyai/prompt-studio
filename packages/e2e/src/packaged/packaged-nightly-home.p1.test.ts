import { beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { buildBinary } from "./packaged-helpers";
import { startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";
import { preparePublishedNightlyHost } from "./published-nightly-host";

// Database markers of published nightlies that this build retires on purpose. Starting a new
// baseline is a breaking release for local data: add the published marker here in the same pull
// request as the ADR that decides it, and remove the entry once a nightly with the new baseline ships.
const deliberateRetirements: string[] = [];

// The rule protects what this build does with a nightly home. A broken or unpublished nightly, or a
// GitHub outage, is not this change's fault, and failing on it would also block the change that
// repairs the nightly. Those phases skip with a warning; only the candidate phase can fail.
let nightly: Awaited<ReturnType<typeof preparePublishedNightlyHost>> | null = null;
beforeAll(async () => {
  try {
    nightly = await preparePublishedNightlyHost();
  } catch (error) {
    console.warn(`Skipping the nightly home check: ${error instanceof Error ? error.message : error}`);
  }
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
}, 180_000);

// The runtime is still writing this log, so only newline-terminated lines are complete.
const retirementPhases = async (path: string) =>
  (await Bun.file(path).text())
    .split("\n")
    .slice(0, -1)
    .map((line) => JSON.parse(line) as { event?: string; phase?: string })
    .filter((entry) => entry.event === "runtime.startup.phase" && entry.phase?.startsWith("database_retir"))
    .map((entry) => entry.phase);

test(
  "a home written by the latest published nightly opens in this build with its projects",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "packaged-nightly-home-"));
    let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
    const request = async (method: string, path: string, body?: unknown) => {
      const response = await fetch(host!.baseUrl + path, {
        method,
        headers: { authorization: `Bearer ${host!.descriptor.token}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const value = await response.json();
      expect(response.status, JSON.stringify(value)).toBeLessThan(300);
      return value;
    };
    try {
      if (!nightly) return;
      let projectId: string;
      let marker: string;
      try {
        const folder = join(root, "project");
        await mkdir(folder);
        host = await startPackagedServe(root, {}, nightly.path);
        projectId = (await request("POST", "/v1/projects", folderProjectInput({ name: "Nightly project" }, folder))).id;
        await stopProcess(host.child);
        host = undefined;
        marker = (await Bun.file(join(root, "db.sqlite", ".pstdio-engine.json")).text()).trim();
      } catch (error) {
        console.warn(`Skipping the nightly home check: ${nightly.tag} could not write a home: ${error}`);
        return;
      }
      if (deliberateRetirements.includes(marker)) return;

      const log = join(root, "candidate.log");
      host = await startPackagedServe(root, { PSTDIO_LOG_PATH: log });
      expect(
        await retirementPhases(log),
        `${nightly.tag} wrote ${marker}, which this build retires. Rebase on main if it already has a newer baseline. Otherwise starting a new baseline needs an ADR and an entry in deliberateRetirements.`,
      ).toEqual([]);
      expect(await request("GET", "/v1/projects")).toEqual([
        expect.objectContaining({ id: projectId, name: "Nightly project" }),
      ]);
    } finally {
      try {
        if (host) await stopProcess(host.child);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
