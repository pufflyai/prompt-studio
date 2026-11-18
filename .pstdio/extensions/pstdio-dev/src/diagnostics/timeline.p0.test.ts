import { describe, expect, test } from "bun:test";
import { buildTimeline } from "./timeline";

const PROJECT = "timeline-fixture-project";
const startup = (time: string, phase: string, elapsedMs: number) =>
  JSON.stringify({ time, event: "runtime.startup.phase", phase, elapsedMs });
const setup = (time: string, phase: string, state: string, span: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ time, event: "runtime.setup.phase", phase, state, span_id: span, project_id: PROJECT, ...extra });
const quit = (time: string) =>
  JSON.stringify({ time, event: "runtime.shutdown.phase", phase: "database", state: "settled" });

describe("startup timeline", () => {
  test("keeps interleaved startup events with their own launch", () => {
    const entry = (time: string, phase: string, elapsedMs: number, autostartId: string) =>
      JSON.stringify({ time, event: "runtime.startup.phase", phase, elapsedMs, autostartId });
    const [later, earlier] = buildTimeline([
      entry("2026-11-15T08:00:00.100Z", "database_locked", 100, "earlier"),
      entry("2026-11-15T08:00:00.200Z", "database_locked", 50, "later"),
      entry("2026-11-15T08:00:00.300Z", "app_ready", 300, "earlier"),
      entry("2026-11-15T08:00:00.400Z", "app_ready", 250, "later"),
    ]);

    expect([later?.readyMs, earlier?.readyMs]).toEqual([250, 300]);
    expect(new Set([later?.id, earlier?.id]).size).toBe(2);
    expect([later?.startup.length, earlier?.startup.length]).toEqual([2, 2]);
  });

  test("groups startup steps and a completed project setup into one launch", () => {
    const [launch] = buildTimeline([
      startup("2026-11-15T08:09:32.321Z", "database_locked", 116),
      startup("2026-11-15T08:09:35.277Z", "app_ready", 3073),
      setup("2026-11-15T08:09:57.979Z", "project.config", "started", "a"),
      setup("2026-11-15T08:09:58.210Z", "project.config", "completed", "a", { duration_ms: 231 }),
      setup("2026-11-15T08:09:58.211Z", "project.repo_extensions", "started", "b"),
      JSON.stringify({
        time: "2026-11-15T08:09:58.211Z",
        event: "runtime.setup.phase",
        phase: "default_extensions.checkout",
        state: "started",
        span_id: "c",
      }),
      JSON.stringify({
        time: "2026-11-15T08:09:59.169Z",
        event: "runtime.setup.phase",
        phase: "default_extensions.checkout",
        state: "completed",
        span_id: "c",
        duration_ms: 958,
      }),
      setup("2026-11-15T08:09:59.171Z", "project.repo_extensions", "completed", "b", { duration_ms: 961 }),
      setup("2026-11-15T08:09:59.206Z", "project.files", "started", "d"),
      setup("2026-11-15T08:11:23.384Z", "project.files", "completed", "d", { duration_ms: 84177 }),
      setup("2026-11-15T08:11:23.384Z", "project.provision", "started", "e"),
      setup("2026-11-15T08:11:23.983Z", "project.provision", "completed", "e", { duration_ms: 600 }),
    ]);
    expect(launch!.startedAt).toBe("2026-11-15T08:09:32.205Z");
    expect(launch!.readyMs).toBe(3073);
    expect(launch!.startup.map((step) => step.durationMs)).toEqual([116, 2957]);
    const [projectSetup] = launch!.setups;
    expect(projectSetup!.outcome).toBe("completed");
    expect(projectSetup!.durationMs).toBe(86004);
    expect(projectSetup!.steps.find((step) => step.phase === "default_extensions.checkout")!.depth).toBe(1);
    expect(projectSetup!.steps.find((step) => step.phase === "project.files")!.durationMs).toBe(84177);
  });

  test("marks a setup cut short by quitting as interrupted", () => {
    const [launch] = buildTimeline([
      startup("2026-11-15T07:57:13.000Z", "database_locked", 100),
      setup("2026-11-15T07:57:27.091Z", "project.config", "started", "a"),
      setup("2026-11-15T07:57:27.300Z", "project.config", "completed", "a", { duration_ms: 209 }),
      setup("2026-11-15T07:57:27.400Z", "project.files", "started", "b"),
      quit("2026-11-15T07:57:44.633Z"),
    ]);
    expect(launch!.ended).toBe("quit");
    expect(launch!.setups[0]!.outcome).toBe("interrupted");
    expect(launch!.setups[0]!.steps.at(-1)!.state).toBe("failed");
  });

  test("starts a new launch when elapsed time restarts without a clean shutdown", () => {
    const launches = buildTimeline([
      startup("2026-11-10T05:00:00.000Z", "database_locked", 100),
      setup("2026-11-10T05:00:10.000Z", "project.config", "started", "a"),
      startup("2026-11-10T06:00:00.000Z", "database_locked", 120),
    ]);
    expect(launches).toHaveLength(2);
    expect(launches[1]!.ended).toBe("unknown");
    expect(launches[1]!.setups[0]!.outcome).toBe("interrupted");
    expect(launches[0]!.ended).toBe("running");
  });

  test("ends a setup as failed when a top-level step fails", () => {
    const [launch] = buildTimeline([
      startup("2026-11-11T20:40:00.000Z", "database_locked", 100),
      setup("2026-11-11T20:42:59.000Z", "project.config", "started", "a"),
      setup("2026-11-11T20:43:00.000Z", "project.config", "completed", "a", { duration_ms: 1000 }),
      setup("2026-11-11T20:43:01.000Z", "project.files", "started", "b"),
      setup("2026-11-11T20:49:40.000Z", "project.files", "failed", "b", { duration_ms: 398437 }),
    ]);
    expect(launch!.setups[0]!.outcome).toBe("failed");
    expect(launch!.setups[0]!.durationMs).toBe(401000);
  });
});
