import { closeSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  contract,
  coverage,
  type Profile,
  runBenchmarkCase,
  type ScenarioResult,
  scenarios,
  summarize,
  type Workload,
} from "storage-scale-fixture";
import { measureScaleNavigation } from "./storage-scale-browser";
import { applyContainerProfile, configuredContainer } from "./storage-scale-container";
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
export type Scenario = ReturnType<typeof scenarios>[number];
export interface ScaleSampleCase {
  home: string;
  root: string;
  kind: Workload;
  profile: Profile;
  scenario: Scenario;
  sync: boolean;
}
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

export const sampleScaleScenario = async (input: ScaleSampleCase, emit: (row: object) => void) => {
  const { home, root, kind, profile, scenario } = input;
  const fixture = JSON.parse(readFileSync(join(home, "scale-project.json"), "utf8")) as ScaleFixture;
  if (fixture.kind !== kind) throw new Error("Fixture kind mismatch");
  const container = configuredContainer(home);
  if (container) emit({ phase: "runtime-control", profile, ...applyContainerProfile(container, profile) });
  emit({ phase: "case-setup", scenario, status: "started" });
  const oracles = queryOracles(kind);
  const sync = input.sync ? await createScaleSyncFixture(home, fixture, emit) : undefined;
  try {
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
    emit({ phase: "case-setup", scenario, status: "completed" });
    const isEdit =
      (contract.edits as readonly string[]).includes(scenario.operation) ||
      scenario.operation === "multiline" ||
      scenario.operation === "all-owner-edit-burst";
    const measured = isEdit ? await measureEdit(ctx, scenario) : await measureRead(ctx, scenario);
    emit({
      phase: "sample",
      ...measured,
      passed: measured.passed && scenario.background === "idle",
      contentionCoverage: scenario.background === "idle" ? "not-requested" : "attempted-unverified",
    });
  } finally {
    await sync?.close();
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
  const results: (ScenarioResult & { durationMs?: number; status: string })[] = [];
  const selected = selectScenarios(kind, profile, options);
  if (!selected.length) throw new Error("Unknown operation or background; no scenarios selected");
  try {
    for (const [index, scenario] of selected.entries()) {
      if (scenario.background !== "idle" && !options.sync) {
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
      const name = `${profile}-${scenario.background}-${scenario.temperature}-${scenario.operation}-${scenario.sample}`;
      const inputPath = join(root, `case-${index}-input.json`);
      const outputPath = join(root, `case-${index}.jsonl`);
      writeFileSync(inputPath, JSON.stringify({ home, root, kind, profile, scenario, sync: options.sync }));
      const stdout = openSync(outputPath, "wx");
      const stderr = openSync(join(root, `case-${index}.stderr.log`), "wx");
      let result: Awaited<ReturnType<typeof runBenchmarkCase>>;
      try {
        result = await runBenchmarkCase({
          name,
          command: process.execPath,
          args: [join(import.meta.dirname, "storage-scale-case.ts"), inputPath],
          stdout,
          stderr,
          containerFilters: [configuredContainer(home)?.containerId]
            .filter((id) => id !== undefined)
            .map((id) => `id=${id}`),
          emit,
        });
      } finally {
        closeSync(stdout);
        closeSync(stderr);
      }
      if (!result.complete) {
        const row = { ...scenario, passed: false, status: result.status, caseResult: result };
        results.push(row);
        emit({ phase: "sample", ...row });
        emit({ phase: "fixture-invalid", reason: "Case incomplete; discard and reseed. Do not retry.", scenario });
        throw new Error(`Case ${name} ${result.status}; partial output retained at ${outputPath}`);
      }
      const rows = readFileSync(outputPath, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const samples = rows.filter((row) => row.phase === "sample");
      if (samples.length !== 1) throw new Error(`Case ${name} did not produce exactly one sample`);
      results.push(samples[0]);
      for (const row of rows) emit(row);
    }
  } finally {
    emit({
      phase: "coverage",
      ...coverage(kind, results),
      scope: options,
      profile,
      executed: results.filter((row) => row.status === "measured").length,
      unavailable: results.filter((row) => row.status === "unavailable").length,
      errors: results.filter((row) => ["failed", "aborted", "timed-out"].includes(row.status)).length,
    });
    emit({ phase: "summary", groups: summarizeResults(results) });
  }
};
