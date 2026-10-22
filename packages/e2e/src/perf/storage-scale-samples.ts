import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  contract,
  coverage,
  type Profile,
  type ScenarioResult,
  scenarios,
  summarize,
  type Workload,
} from "storage-scale-fixture";
import { measureScaleNavigation } from "./storage-scale-browser";
import { samplePublicEdit } from "./storage-scale-edits";
import { measureScalePage } from "./storage-scale-page";
import { queryOracles, sampleQuery } from "./storage-scale-queries";
import { configureScaleView, type ScaleFixture, startScaleRuntime } from "./storage-scale-runtime";
import { createScaleSyncFixture } from "./storage-scale-sync";
import { sampleVisibleEdit } from "./storage-scale-visible-edit";
import { sampleWriteBurst } from "./storage-scale-write-burst";

export interface SampleOptions {
  operation?: string;
  background?: string;
  sync: boolean;
}
type Scenario = ReturnType<typeof scenarios>[number];
interface Context {
  home: string;
  root: string;
  fixture: ScaleFixture;
  profile: Profile;
  environment: Record<string, string>;
  oracles: ReturnType<typeof queryOracles>;
  begin?: (runtime: Awaited<ReturnType<typeof startScaleRuntime>>) => Promise<unknown>;
  emit: (data: object) => void;
}

const selectScenarios = (kind: Workload, profile: Profile, options: SampleOptions) =>
  scenarios(kind).filter(
    (row) =>
      row.profile === profile &&
      (!options.operation || row.operation === options.operation) &&
      (!options.background || row.background === options.background),
  );

const summarizeResults = (results: (ScenarioResult & { durationMs?: number })[]) => {
  const groups = new Map<string, number[]>();
  for (const row of results) {
    if (row.durationMs === undefined) continue;
    const id = `${row.profile}/${row.background}/${row.temperature}/${row.operation}`;
    groups.set(id, [...(groups.get(id) ?? []), row.durationMs]);
  }
  return [...groups].map(([id, values]) => ({ id, ...summarize(values) }));
};

const measureEdit = async (ctx: Context, scenario: Scenario) => {
  if (scenario.operation === "all-owner-edit-burst")
    return {
      ...scenario,
      ...(await sampleWriteBurst(ctx.home, ctx.fixture, scenario.temperature, ctx.environment, ctx.begin)),
      status: "measured",
    };
  const measured = await samplePublicEdit(
    ctx.home,
    ctx.fixture,
    scenario.operation,
    scenario.temperature,
    scenario.sample,
    ctx.environment,
    ctx.begin,
  );
  const visible =
    scenario.operation === "direct-sdk-first-write"
      ? undefined
      : await sampleVisibleEdit(ctx.home, ctx.fixture, ctx.profile, scenario.operation, ctx.environment, ctx.begin);
  const screenshot = visible
    ? `${ctx.profile}-${scenario.background}-${scenario.temperature}-${scenario.operation}-${scenario.sample}.png`
    : undefined;
  if (visible && screenshot) writeFileSync(join(ctx.root, screenshot), visible.screenshot);
  return {
    ...scenario,
    ...measured,
    visible: visible ? { ...visible, screenshot } : undefined,
    passed: measured.passed && (visible?.passed ?? true),
    failures: [
      ...measured.failures,
      ...(visible?.failures ?? []),
      ...(visible && scenario.temperature === "cold" ? ["cold-visible-edit-unavailable-owner-preloaded"] : []),
    ],
    durationMs: visible?.durationMs ?? measured.acknowledgementMs,
    status: "measured",
  };
};

const measureRead = async (ctx: Context, scenario: Scenario) => {
  const isView = scenario.operation === "board" || scenario.operation === "list";
  if (isView && ctx.fixture.kind === "rich") {
    const prepare = await startScaleRuntime(ctx.home, ctx.environment);
    try {
      await configureScaleView(prepare, ctx.fixture.projectId, scenario.operation as "board" | "list");
    } finally {
      await prepare.stop();
    }
  }
  const runtime = await startScaleRuntime(ctx.home, ctx.environment);
  try {
    ctx.emit({ phase: "runtime-startup", scenario, durationMs: runtime.startupMs, ...runtime.controlEvidence });
    if (scenario.temperature === "warm" && !isView)
      await sampleQuery(runtime, ctx.fixture, scenario.operation, ctx.oracles);
    const background = ctx.begin?.(runtime);
    if (!isView) {
      const measured = await sampleQuery(runtime, ctx.fixture, scenario.operation, ctx.oracles);
      if (background) ctx.emit({ phase: "background", scenario, ...((await background) as object) });
      if (scenario.operation === "second-page") {
        await runtime.stop();
        const visible = await measurePage(ctx, scenario);
        return { ...scenario, ...measured, durationMs: visible.durationMs, visible, status: "measured" };
      }
      return { ...scenario, ...measured, status: "measured" };
    }
    const measured = await measureScaleNavigation(
      runtime,
      ctx.fixture,
      ctx.profile,
      scenario.operation as "board" | "list",
      scenario.temperature,
    );
    const screenshot = `${ctx.profile}-${scenario.background}-${scenario.temperature}-${scenario.operation}-${scenario.sample}.png`;
    writeFileSync(join(ctx.root, screenshot), measured.screenshot);
    if (background) ctx.emit({ phase: "background", scenario, ...((await background) as object) });
    return { ...scenario, ...measured, durationMs: measured.dataReadyMs, status: "measured", screenshot };
  } finally {
    await runtime.stop();
  }
};

const measurePage = async (ctx: Context, scenario: Scenario) => {
  const runtime = await startScaleRuntime(ctx.home, ctx.environment);
  try {
    const running = ctx.begin?.(runtime);
    const visible = await measureScalePage(runtime, ctx.fixture, ctx.profile, scenario.temperature);
    const screenshot = `${ctx.profile}-${scenario.background}-${scenario.temperature}-second-page-${scenario.sample}.png`;
    writeFileSync(join(ctx.root, screenshot), visible.screenshot);
    if (running) ctx.emit({ phase: "background", scenario, ...((await running) as object) });
    return { ...visible, screenshot };
  } finally {
    await runtime.stop();
  }
};

export const sampleScaleRuntime = async (
  home: string,
  root: string,
  kind: Workload,
  profile: Profile,
  emit: (data: object) => void,
  options: SampleOptions,
) => {
  const fixture = JSON.parse(readFileSync(join(home, "scale-project.json"), "utf8")) as ScaleFixture;
  if (fixture.kind !== kind) throw new Error("Fixture kind mismatch");
  const oracles = queryOracles(kind);
  const results: (ScenarioResult & { durationMs?: number; status: string })[] = [];
  const selected = selectScenarios(kind, profile, options);
  if (!selected.length) throw new Error("Unknown operation or background; no scenarios selected");
  const sync = options.sync ? await createScaleSyncFixture(home, fixture, emit) : undefined;
  try {
    for (const scenario of selected) {
      if (scenario.background !== "idle" && !sync) {
        const row = {
          ...scenario,
          passed: false,
          status: "unavailable",
          reason: "Run with --sync to configure the isolated two-device relay fixture",
        };
        results.push(row);
        emit({ phase: "sample", ...row });
        continue;
      }
      const ctx: Context = {
        home,
        root,
        fixture,
        profile,
        emit,
        oracles,
        environment: sync?.environment ?? {},
        begin: scenario.background === "idle" ? undefined : (runtime) => sync!.begin(runtime, scenario.background),
      };
      try {
        const isEdit =
          (contract.edits as readonly string[]).includes(scenario.operation) ||
          scenario.operation === "multiline" ||
          scenario.operation === "all-owner-edit-burst";
        const measured = isEdit ? await measureEdit(ctx, scenario) : await measureRead(ctx, scenario);
        const row = {
          ...measured,
          passed: measured.passed && scenario.background === "idle",
          contentionCoverage: scenario.background === "idle" ? "not-requested" : "attempted-unverified",
        };
        results.push(row);
        emit({ phase: "sample", ...row });
      } catch (error) {
        const row = { ...scenario, passed: false, status: "error", error: String(error) };
        results.push(row);
        emit({ phase: "sample", ...row });
        // Stop rather than retry or continue against an edit whose restoration was not proved.
        emit({
          phase: "fixture-invalid",
          reason: "Scenario failed; discard and reseed before another measurement",
          scenario,
        });
        throw error;
      }
    }
  } finally {
    await sync?.close();
    emit({
      phase: "coverage",
      ...coverage(kind, results),
      scope: options,
      profile,
      executed: results.filter((row) => row.status === "measured").length,
      unavailable: results.filter((row) => row.status === "unavailable").length,
      errors: results.filter((row) => row.status === "error").length,
    });
    emit({ phase: "summary", groups: summarizeResults(results) });
  }
};
