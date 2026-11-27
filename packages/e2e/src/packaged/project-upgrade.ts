import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { chromium, expect, type Page } from "@playwright/test";
import { describeProductionPayload, projectUpgradeLimitMs } from "pstdio-scripts/testing";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";
import { checkCloudProjectUpgrade } from "./project-upgrade-cloud";
import {
  assertProjectToolsRetained,
  assertUpgradeEdit,
  candidateToolVersions,
  editUpgradeProject,
  installedProjectTools,
  type ProjectUpgradeInput,
  readUpgradeProject,
  seedConflictedProject,
  seedDirectUpgrade,
  seedUpgradeProject,
  upgradeApi,
  upgradeCoreProjectTools,
  verifyFirstUpgradeTicketEdit,
} from "./project-upgrade-fixture";
import { assertHomeConflict, assertHomeOpens, checkHomeHistory } from "./project-upgrade-home";
import { captureUpgradeLayouts } from "./project-upgrade-layout";
import { preparePublishedHost, versionFromTag } from "./published-host-binary";

type Seed = Awaited<ReturnType<typeof seedUpgradeProject>>;
type Snapshot = Awaited<ReturnType<typeof readUpgradeProject>>;
type Runtime = Awaited<ReturnType<typeof startPackagedServe>>;

const record = (folder: string, name: string, value: unknown) =>
  Bun.write(join(folder, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);

const firstChange = (before: unknown, after: unknown, path: string): string => {
  if (typeof before !== "object" || before === null || typeof after !== "object" || after === null) return path;
  const left = before as Record<string, unknown>;
  const right = after as Record<string, unknown>;
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (!isDeepStrictEqual(left[key], right[key])) return firstChange(left[key], right[key], `${path}.${key}`);
  }
  return path;
};

const compare = (before: Snapshot, after: Snapshot) => {
  if (!isDeepStrictEqual(before, after))
    throw new Error(`Upgrade changed ${firstChange(before, after, "project")}. See the before and after manifests.`);
};

const seed = async (descriptor: { origin: string; token: string }, input: ProjectUpgradeInput) => {
  const api = upgradeApi(descriptor);
  const fixture = await seedUpgradeProject(api, input);
  const manifest = await readUpgradeProject(api, fixture);
  await record(input.evidence, "before", manifest);
  const tools = await installedProjectTools(api, fixture.id);
  await record(input.evidence, "installed-before", tools);
  return { fixture, manifest, tools };
};

const verify = async (
  descriptor: { origin: string; token: string },
  evidence: string,
  state: Awaited<ReturnType<typeof seed>>,
  expectedVersions?: Map<string, string>,
  expectCompatibleFirstParty = false,
) => {
  const upgrade = upgradeApi(descriptor);
  const changes = await upgradeCoreProjectTools(upgrade, state.fixture.id, expectCompatibleFirstParty);
  await record(evidence, "extension-upgrades", changes);
  await assertProjectToolsRetained(upgrade, state.fixture.id, state.tools, expectedVersions);
  await assertHomeOpens(upgrade, state.fixture.id);
  const after = await readUpgradeProject(upgrade, state.fixture, state.manifest.files);
  await record(evidence, "after", after);
  compare(state.manifest, after);
  await editUpgradeProject(upgrade, state.fixture);
  const edited = await readUpgradeProject(upgrade, state.fixture);
  await record(evidence, "edited", edited);
  return edited;
};

const workbenchRoutes = async (descriptor: Runtime["descriptor"], fixture: Seed) => {
  const api = upgradeApi(descriptor);
  const { extensionIds } = await api.get<{ extensionIds: string[] }>(`/projects/${fixture.id}/extensions/commands`);
  const plannerId = extensionIds.find((id) => /^pstdio\.(pstdio-)?planner$/.test(id));
  const sessionsId = extensionIds.find((id) => /^pstdio\.(pstdio-)?session-browser$/.test(id));
  assert(plannerId && sessionsId, "Planner and Sessions must be enabled in the upgraded workbench");
  const project = `/projects/${fixture.id}/extensions`;
  return {
    tickets: `${project}/${plannerId}/tickets`,
    home: `${project}/pstdio.home/home`,
    conversation: `${project}/${sessionsId}/conversation?resource=${encodeURIComponent(`pstdio://extension-resource/session/${fixture.linkedSession}`)}`,
  };
};

const openSavedWork = async (
  descriptor: Runtime["descriptor"],
  fixture: Seed,
  evidence: string,
  routes: Awaited<ReturnType<typeof workbenchRoutes>>,
  layouts: Awaited<ReturnType<typeof captureUpgradeLayouts>>,
) => {
  const browser = await chromium.launch(PROVISIONED_CHROMIUM);
  let page: Page | undefined;
  try {
    page = await browser.newPage({
      storageState: { cookies: [], origins: [{ origin: descriptor.origin, localStorage: layouts }] },
    });
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    // User-approved 2026-11-20 (#2241): first opens after an upgrade wait for the runtime to install
    // the Workspaces tool that adopts Git Workspaces, which exceeded the 5 s default.
    const firstOpen = { timeout: 30_000 };
    // Open Tickets as the first project request after restart, before API checks can warm it.
    await signInBrowser(page, descriptor, routes.tickets);
    await expect(page.getByTestId("renderer-card").first()).toBeVisible(firstOpen);
    // Click the eyebrow text: the card ignores clicks that start on its session chips, which can fill its centre.
    await page
      .getByTestId("renderer-card")
      .first()
      .getByText(/^[A-Z]+-\d+( \/ [A-Z]+-\d+)*$/)
      .first()
      .click();
    await expect(page.getByTestId("content-editable").filter({ visible: true }).first()).toBeVisible(firstOpen);
    await page.goto(new URL(routes.home, descriptor.origin).href);
    await expect(page.frameLocator('iframe[title="Home"]:visible').getByTestId("start-page")).toBeVisible(firstOpen);
    await expect(
      page.getByRole("banner", { name: "App header" }).getByText(fixture.name, { exact: true }),
    ).toBeVisible();
    await page.goto(new URL(routes.conversation, descriptor.origin).href);
    await expect(page.getByText("Keep the change small.", { exact: false }).first()).toBeVisible(firstOpen);
    await page.screenshot({ path: join(evidence, "saved-conversation.png") });
    await page.getByRole("option", { name: "Extensions", exact: true }).click();
    const search = page.getByTestId("extensions-search");
    await search.fill("Planner");
    await expect(page.getByTestId("extensions-panel").getByTestId("extension-entry").first()).toContainText(/planner/i);
  } catch (error) {
    if (page) {
      await page.screenshot({ path: join(evidence, "workbench-failure.png") }).catch(() => {});
      const visibleText = await page
        .locator("body")
        .innerText()
        .catch(() => "");
      await record(evidence, "workbench-failure", { url: page.url(), visibleText: visibleText.slice(0, 3000) });
    }
    throw error;
  } finally {
    await browser.close();
  }
};

const verifyRestart = async (
  descriptor: { origin: string; token: string },
  evidence: string,
  fixture: Seed,
  edited: Snapshot,
) => {
  const api = upgradeApi(descriptor);
  await assertHomeOpens(api, fixture.id);
  await assertUpgradeEdit(api, fixture);
  const restarted = await readUpgradeProject(api, fixture);
  await record(evidence, "restarted", restarted);
  compare(edited, restarted);
};

const verifyFirstProjectEdit = async (
  runtime: Runtime,
  fixture: Pick<Seed, "id" | "firstTicket">,
  start: number,
  evidence: string,
  limitMs: number,
  expectedContent?: string,
) => {
  const restoreTicket = await verifyFirstUpgradeTicketEdit(upgradeApi(runtime.descriptor), fixture, expectedContent);
  const elapsedMs = performance.now() - start;
  await record(evidence, "upgrade-to-usable-project", { elapsedMs, limitMs });
  assert(
    elapsedMs <= limitMs,
    `Upgrade and first saved project edit took ${elapsedMs.toFixed(0)} ms (limit ${limitMs} ms)`,
  );
  return restoreTicket;
};

const assertCurrentDatabase = async (home: string) => {
  const backups = new Bun.Glob("backups/pre-*-pstdio.db");
  assert.equal(
    [...backups.scanSync({ cwd: home, onlyFiles: false })].length,
    0,
    "Upgrade retired the populated database",
  );
};

const run = async (
  input: ProjectUpgradeInput,
  pair: {
    from: string;
    candidate: string;
    candidateRef: string;
    expectedVersions?: Map<string, string>;
    baseline: string;
  },
) => {
  const { baseline, candidate } = pair;
  const baselineIdentity = await describeProductionPayload(baseline);
  const candidateIdentity = await describeProductionPayload(candidate);
  const binaryVersion = async (path: string) => {
    const process = Bun.spawn([path, "--version"], { stdout: "pipe" });
    const version = (await new Response(process.stdout).text()).trim();
    assert.equal(await process.exited, 0, `Cannot run ${path}`);
    return version;
  };
  assert.equal(await binaryVersion(baseline), versionFromTag(pair.from), "Baseline version");
  const candidateVersion = await binaryVersion(candidate);
  await record(input.evidence, "versions", {
    from: pair.from,
    candidateVersion,
    candidateRef: pair.candidateRef,
    profile: input.profile,
    baselineDigest: baselineIdentity.payloadDigest,
    candidateDigest: candidateIdentity.payloadDigest,
    platform: process.platform,
    arch: process.arch,
  });
  const limitMs = projectUpgradeLimitMs(candidateVersion);
  if (input.profile === "cloud")
    return checkCloudProjectUpgrade(input.home, input.evidence, baseline, candidate, limitMs);
  const launch = async (binary: string, phase: string) => {
    console.log(`[project upgrade ${input.profile}] ${phase}`);
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error(`The ${phase} runtime did not become ready`)),
      // A converting runtime may use the whole upgrade limit before it is ready.
      Math.max(PACKAGED_TEST_TIMEOUT, limitMs),
    );
    try {
      return await startPackagedServe(
        input.home,
        {
          PSTDIO_DB_PATH: join(input.home, "pstdio.db"),
          PSTDIO_LOG_PATH: join(input.evidence, `${phase}.jsonl`),
          PSTDIO_DEFAULT_EXTENSIONS: "",
          PSTDIO_EXTENSION_CATALOG: "",
          GITHUB_TOKEN: "",
          GH_TOKEN: "",
        },
        binary,
        undefined,
        undefined,
        controller.signal,
      );
    } finally {
      clearTimeout(timer);
    }
  };
  let runtime: Runtime | undefined;
  try {
    runtime = await launch(baseline, "baseline");
    if (input.profile === "direct") {
      const ticket = await seedDirectUpgrade(upgradeApi(runtime.descriptor), input.home);
      await stopProcess(runtime.child);
      runtime = undefined;
      const start = performance.now();
      runtime = await launch(candidate, "upgrade");
      await verifyFirstProjectEdit(runtime, ticket, start, input.evidence, limitMs, ticket.content);
      await stopProcess(runtime.child);
      runtime = await launch(candidate, "restart");
      await assertUpgradeEdit(upgradeApi(runtime.descriptor), ticket);
      assert.equal(await Bun.file(ticket.file).text(), ticket.content);
      return;
    }
    if (input.profile === "conflicted") {
      const id = await seedConflictedProject(upgradeApi(runtime.descriptor), input.home);
      await stopProcess(runtime.child);
      runtime = undefined;
      const before = await checkHomeHistory(input, id);
      runtime = await launch(candidate, "upgrade");
      await assertCurrentDatabase(input.home);
      await assertHomeConflict(upgradeApi(runtime.descriptor), id);
      await stopProcess(runtime.child);
      runtime = undefined;
      await checkHomeHistory(input, id, before);
      return;
    }
    const state = await seed(runtime.descriptor, input);
    const layouts = await captureUpgradeLayouts(runtime.descriptor, state.fixture.id);
    await stopProcess(runtime.child);
    runtime = undefined;
    const home = await checkHomeHistory(input, state.fixture.id);
    const start = performance.now();
    runtime = await launch(candidate, "upgrade");
    const restoreTicket = await verifyFirstProjectEdit(runtime, state.fixture, start, input.evidence, limitMs);
    await restoreTicket();
    await assertCurrentDatabase(input.home);
    const edited = await verify(
      runtime.descriptor,
      input.evidence,
      state,
      pair.expectedVersions,
      /^pstdio@0\.(46|47|48)\./.test(pair.from) && candidateVersion.startsWith("0.49."),
    );
    const routes = await workbenchRoutes(runtime.descriptor, state.fixture);
    await stopProcess(runtime.child);
    runtime = await launch(candidate, "restart");
    await openSavedWork(runtime.descriptor, state.fixture, input.evidence, routes, layouts);
    await assertProjectToolsRetained(
      upgradeApi(runtime.descriptor),
      state.fixture.id,
      state.tools,
      pair.expectedVersions,
    );
    await verifyRestart(runtime.descriptor, input.evidence, state.fixture, edited);
    await stopProcess(runtime.child);
    runtime = undefined;
    await checkHomeHistory(input, state.fixture.id, home);
  } finally {
    if (runtime) await stopProcess(runtime.child);
  }
};

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      from: { type: "string" },
      candidate: { type: "string" },
      "candidate-ref": { type: "string" },
      "candidate-root": { type: "string" },
      "baseline-binary": { type: "string" },
      profile: { type: "string" },
      evidence: { type: "string" },
    },
  });
  const profile = values.profile;
  assert(
    profile === undefined ||
      profile === "active" ||
      profile === "aged" ||
      profile === "conflicted" ||
      profile === "cloud" ||
      profile === "direct",
    "Choose --profile active, aged, conflicted, cloud or direct",
  );
  const { from, candidate, "candidate-ref": candidateRef, "baseline-binary": baselinePath } = values;
  assert(from, "Supply the published release tag with --from");
  versionFromTag(from);
  assert(candidate, "Supply a compiled --candidate binary");
  assert(candidateRef && /^[a-f0-9]{40}$/.test(candidateRef), "Supply the full --candidate-ref Git SHA");
  const directory = resolve(values.evidence ?? "test-results/project-upgrades");
  await mkdir(directory, { recursive: true });
  const evidence = await mkdtemp(join(directory, "run-"));
  console.log(`Project upgrade ${from} → ${candidateRef}. Evidence in ${evidence}`);
  await record(evidence, "pair", { from, candidateRef });
  const baseline = baselinePath ? resolve(baselinePath) : (await preparePublishedHost(from)).path;
  const expectedVersions = values["candidate-root"] ? await candidateToolVersions(values["candidate-root"]) : undefined;
  const pair = { from, candidateRef, baseline, candidate: resolve(candidate), expectedVersions };
  const failures: unknown[] = [];
  const profiles: ProjectUpgradeInput["profile"][] = profile ? [profile] : ["active", "aged", "cloud"];
  if (!profile && from === "pstdio@0.47.0") profiles.push("conflicted");
  for (const variant of profiles) {
    const output = join(evidence, variant);
    await mkdir(output);
    const root = await mkdtemp(join(tmpdir(), "pstdio-project-upgrade-"));
    const home = join(root, "home");
    try {
      await mkdir(home);
      await run({ home, evidence: output, profile: variant }, pair);
      await record(output, "result", { status: "passed" });
    } catch (error) {
      failures.push(error);
      await record(output, "result", { status: "failed", error: String(error) });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
  if (failures.length) throw new AggregateError(failures, "Packaged project upgrade failed");
}
