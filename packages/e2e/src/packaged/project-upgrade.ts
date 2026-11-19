import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { chromium, expect, type Page } from "@playwright/test";
import { describeProductionPayload } from "pstdio-scripts/testing";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";
import {
  assertProjectToolsRetained,
  assertUpgradeEdit,
  candidateToolVersions,
  editUpgradeProject,
  installedProjectTools,
  type ProjectUpgradeInput,
  readUpgradeProject,
  seedConflictedProject,
  seedUpgradeProject,
  upgradeApi,
  upgradeCoreProjectTools,
} from "./project-upgrade-fixture";
import { assertHomeConflict, assertHomeOpens, checkHomeHistory } from "./project-upgrade-home";
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
) => {
  const upgrade = upgradeApi(descriptor);
  const changes = await upgradeCoreProjectTools(upgrade, state.fixture.id);
  await record(evidence, "extension-upgrades", changes);
  await assertProjectToolsRetained(upgrade, state.fixture.id, state.tools, expectedVersions);
  await assertHomeOpens(upgrade, state.fixture.id);
  const after = await readUpgradeProject(upgrade, state.fixture);
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
) => {
  const browser = await chromium.launch(PROVISIONED_CHROMIUM);
  let page: Page | undefined;
  const clock = Date.now();
  const times: Record<string, number> = {};
  let phase = "tickets";
  try {
    page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    // Open Tickets as the first project request after restart, before API checks can warm it.
    await signInBrowser(page, descriptor, routes.tickets);
    await expect(page.getByTestId("renderer-card").first()).toBeVisible();
    times.tickets = Date.now() - clock;
    phase = "editor";
    await page.getByTestId("renderer-card").first().click();
    await expect(page.getByTestId("content-editable").filter({ visible: true }).first()).toBeVisible();
    times.editor = Date.now() - clock;
    phase = "home";
    await page.goto(new URL(routes.home, descriptor.origin).href);
    await expect(
      page.frameLocator('iframe[title="Home"]:visible').getByText(fixture.name, { exact: true }),
    ).toBeVisible();
    times.home = Date.now() - clock;
    phase = "conversation";
    await page.goto(new URL(routes.conversation, descriptor.origin).href);
    await expect(page.getByText("Keep the change small.", { exact: false }).first()).toBeVisible();
    await page.screenshot({ path: join(evidence, "saved-conversation.png") });
  } catch (error) {
    if (page) {
      times.failed = Date.now() - clock;
      const expected = phase === "tickets" ? page.getByTestId("renderer-card").first() : phase === "home" ? page.frameLocator('iframe[title="Home"]:visible').getByText(fixture.name, { exact: true }) : undefined;
      if (expected) { try { await expected.waitFor({ state: "visible", timeout: 45_000 }); times.eventual = Date.now() - clock; } catch {} }
      await page.screenshot({ path: join(evidence, "workbench-failure.png") }).catch(() => {});
      const visibleText = await page
        .locator("body")
        .innerText()
        .catch(() => "");
      await record(evidence, "workbench-failure", { url: page.url(), visibleText: visibleText.slice(0, 3000) });
    }
    throw error;
  } finally {
    await record(evidence, "observed-timings", times);
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
  const launch = async (binary: string, phase: string) => {
    console.log(`[project upgrade ${input.profile}] ${phase}`);
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error(`The ${phase} runtime did not become ready`)),
      PACKAGED_TEST_TIMEOUT,
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
    await stopProcess(runtime.child);
    runtime = undefined;
    const home = await checkHomeHistory(input, state.fixture.id);
    runtime = await launch(candidate, "upgrade");
    await assertCurrentDatabase(input.home);
    const edited = await verify(runtime.descriptor, input.evidence, state, pair.expectedVersions);
    const routes = await workbenchRoutes(runtime.descriptor, state.fixture);
    await stopProcess(runtime.child);
    runtime = await launch(candidate, "restart");
    await openSavedWork(runtime.descriptor, state.fixture, input.evidence, routes);
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
    profile === undefined || profile === "active" || profile === "aged" || profile === "conflicted",
    "Choose --profile active, aged or conflicted",
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
  const profiles: ProjectUpgradeInput["profile"][] = profile ? [profile] : ["active", "aged"];
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
