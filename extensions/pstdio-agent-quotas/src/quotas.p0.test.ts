import { expect, test } from "bun:test";
import { forecastLimit, formatResetIn, headlineLimits, limitSeverity, remainingColor } from "./format";
import {
  chooseProvider,
  isFresh,
  isSnapshot,
  pickEnabled,
  providers,
  readQuotaStatus,
  STALE_MS,
  sameReading,
  UNAVAILABLE_STALE_MS,
} from "./quotas";
import type { ProviderQuotas } from "./shared";

const now = Date.parse("2026-11-27T12:00:00Z");
const claude: ProviderQuotas = {
  id: "harness-claude-code",
  label: "Claude Code",
  short: "Claude",
  status: "available",
  checkedAt: new Date(now - 60_000).toISOString(),
  limits: [
    {
      id: "five_hour",
      label: "5-hour window",
      remainingPercent: 62,
      windowMinutes: 300,
      resetsAt: "2026-11-27T14:14:00Z",
    },
    { id: "seven_day_opus", label: "Opus weekly", remainingPercent: 90, windowMinutes: 10080 },
    { id: "seven_day", label: "Weekly", remainingPercent: 15, windowMinutes: 10080, resetsAt: "2026-11-30T16:00:00Z" },
  ],
};

test("headline picks the 5-hour and the general weekly window", () => {
  const { session, weekly } = headlineLimits(claude);
  expect(session?.remainingPercent).toBe(62);
  expect(weekly?.id).toBe("seven_day");
});

test("colors warn when little is left", () => {
  expect(remainingColor({ id: "x", label: "x", remainingPercent: 50 }, now)).toBe("fg.muted");
  expect(remainingColor({ id: "x", label: "x", remainingPercent: 15 }, now)).toBe("fg.warning");
  expect(remainingColor({ id: "x", label: "x", remainingPercent: 3 }, now)).toBe("fg.error");
});

test("reset countdown", () => {
  expect(formatResetIn("2026-11-27T14:14:00Z", now)).toBe("2h 14m");
  expect(formatResetIn("2026-11-30T16:00:00Z", now)).toBe("3d 4h");
  expect(formatResetIn("2026-11-27T11:00:00Z", now)).toBe("now");
  expect(formatResetIn(undefined, now)).toBeUndefined();
});

test("available readings are reused for five minutes, readings without data for one", () => {
  expect(isFresh(claude, now)).toBe(true);
  expect(isFresh(claude, now + STALE_MS)).toBe(false);
  const empty = { ...claude, status: "unavailable" as const, limits: [], checkedAt: new Date(now).toISOString() };
  expect(isFresh(empty, now + UNAVAILABLE_STALE_MS - 1)).toBe(true);
  expect(isFresh(empty, now + UNAVAILABLE_STALE_MS)).toBe(false);
  expect(isFresh(undefined, now)).toBe(false);
});

test("a repeated answer is not a change", () => {
  expect(sameReading(claude, { ...claude, checkedAt: new Date(now + 1).toISOString() })).toBe(true);
  expect(sameReading(claude, { ...claude, limits: claude.limits.slice(1) })).toBe(false);
  expect(sameReading(undefined, claude)).toBe(false);
});

test("validates harness output", () => {
  expect(isSnapshot({ status: "available", checkedAt: claude.checkedAt, limits: claude.limits })).toBe(true);
  expect(isSnapshot({ status: "available", checkedAt: claude.checkedAt, limits: [{ id: 1 }] })).toBe(false);
  expect(isSnapshot(null)).toBe(false);
});

test("selection keeps the saved provider while it is on, otherwise the first one on", () => {
  const on = [{ id: "harness-claude-code" }, { id: "harness-codex" }];
  expect(chooseProvider(on, "harness-codex")?.id).toBe("harness-codex");
  expect(chooseProvider(on, "harness-pi")?.id).toBe("harness-claude-code");
  expect(chooseProvider(on, undefined)?.id).toBe("harness-claude-code");
  expect(chooseProvider([], "harness-codex")).toBeUndefined();
});

test("every provider calls its harness's quotas command", () => {
  expect(providers.map((provider) => provider.extensionId)).toEqual([
    "pstdio.harness-claude-code",
    "pstdio.harness-codex",
    "pstdio.harness-copilot",
    "pstdio.harness-open-code",
    "pstdio.harness-pi",
  ]);
});

// A 5-hour window that started 2.5 hours ago (half elapsed).
const halfway = (remainingPercent: number) => ({
  id: "five_hour",
  label: "5-hour window",
  remainingPercent,
  windowMinutes: 300,
  resetsAt: new Date(now + 150 * 60_000).toISOString(),
});

test("forecast projects the current pace to the reset", () => {
  expect(forecastLimit(halfway(70), now, now)?.projectedPercent).toBeCloseTo(60);
  expect(forecastLimit(halfway(70), now, now)?.runsOutAt).toBeUndefined();
  // 60% used in half the window: on pace for 120%, out at 5/6 of the window.
  const fast = forecastLimit(halfway(40), now, now)!;
  expect(fast.projectedPercent).toBeCloseTo(120);
  expect(fast.runsOutAt).toBe(now + 100 * 60_000);
});

test("forecast waits for a tenth of the window and needs reset and length", () => {
  const early = { ...halfway(50), resetsAt: new Date(now + 290 * 60_000).toISOString() };
  expect(forecastLimit(early, now, now)).toBeUndefined();
  expect(forecastLimit({ ...halfway(50), resetsAt: undefined }, now, now)).toBeUndefined();
  expect(forecastLimit({ ...halfway(50), windowMinutes: undefined }, now, now)).toBeUndefined();
});

test("severity turns orange when on pace to run out, red when well before the reset", () => {
  expect(limitSeverity(halfway(70), now, now)).toBe("ok");
  expect(limitSeverity(halfway(48), now, now)).toBe("warning"); // 104%
  expect(limitSeverity(halfway(30), now, now)).toBe("error"); // 140%
  expect(limitSeverity(halfway(4), now, now)).toBe("error");
});

test("a reading is stale once any of its windows has reset", () => {
  const reset = { ...claude, limits: [{ ...claude.limits[0]!, resetsAt: new Date(now - 1_000).toISOString() }] };
  expect(isFresh(reset, now)).toBe(false);
});

test("a slow or failed extension listing keeps the last known harnesses", () => {
  const saved = { ids: ["pstdio.harness-claude-code", "pstdio.harness-codex"], checkedAt: new Date(now).toISOString() };
  const ids = (list: { id: string }[]) => list.map((provider) => provider.id);
  expect(ids(pickEnabled(undefined, saved))).toEqual(["harness-claude-code", "harness-codex"]);
  expect(ids(pickEnabled(["pstdio.harness-pi"], saved))).toEqual(["harness-pi"]);
  expect(pickEnabled(undefined, undefined)).toHaveLength(providers.length);
});

test("the forecast keeps the pace of the reading as the clock moves on", () => {
  // Read at `now` with 60% used halfway through: 120%. Four minutes later the same reading still says 120%.
  expect(forecastLimit(halfway(40), now, now + 4 * 60_000)?.projectedPercent).toBeCloseTo(120);
  expect(limitSeverity(halfway(40), now, now + 4 * 60_000)).toBe("warning");
  // Once the window has reset, an old reading projects nothing.
  expect(forecastLimit(halfway(40), now, now + 151 * 60_000)).toBeUndefined();
});

test("model-specific weekly windows never stand in for the general weekly one", () => {
  const modelOnly = { ...claude, limits: claude.limits.filter((limit) => limit.id !== "seven_day") };
  expect(headlineLimits(modelOnly).weekly).toBeUndefined();
  const scoped = { id: "model_scoped.Opus", label: "Opus weekly", remainingPercent: 50, windowMinutes: 10080 };
  expect(headlineLimits({ ...claude, limits: [scoped] }).weekly).toBeUndefined();
  const tagged = {
    id: "x.secondary",
    label: "Weekly",
    remainingPercent: 50,
    windowMinutes: 10080,
    modelFamily: "opus",
  };
  expect(headlineLimits({ ...claude, limits: [tagged] }).weekly).toBeUndefined();
  // Other harnesses name their general weekly window differently; the length still finds it.
  const codex = { id: "codex.secondary", label: "codex · Weekly", remainingPercent: 10, windowMinutes: 10080 };
  expect(headlineLimits({ ...claude, limits: [codex] }).weekly?.id).toBe("codex.secondary");
});

// A host for readQuotaStatus: in-memory storage, a counted harness command and recorded events.
const fakeHost = (answer: () => unknown) => {
  const collections = new Map<string, Map<string, unknown>>();
  const calls = { harness: 0, events: 0 };
  const ctx = {
    storage: {
      collection: (name: string) => {
        const items = collections.get(name) ?? new Map<string, unknown>();
        collections.set(name, items);
        return {
          get: async (id: string) => items.get(id),
          put: async (id: string, value: unknown) => void items.set(id, structuredClone(value)),
        };
      },
    },
    commands: {
      execute: async () => {
        calls.harness++;
        return { ok: true, value: answer() };
      },
    },
    events: { emit: async () => void calls.events++ },
    extensions: {
      list: async () => ({ extensions: [{ extensionId: "pstdio.harness-codex", enabled: true, status: "loaded" }] }),
    },
  };
  return { ctx: ctx as unknown as Parameters<typeof readQuotaStatus>[0], calls };
};

test("a harness without data is asked once per minute, and repeating it emits nothing", async () => {
  const { ctx, calls } = fakeHost(() => ({ status: "unavailable", checkedAt: new Date().toISOString(), limits: [] }));
  // The first read stores the answer and announces it; views reload on that event and read again.
  expect((await readQuotaStatus(ctx)).selected?.status).toBe("unavailable");
  expect(calls).toEqual({ harness: 1, events: 1 });
  // The reload is answered from storage: no harness call and no event, so the cycle stops.
  await readQuotaStatus(ctx);
  await readQuotaStatus(ctx);
  expect(calls).toEqual({ harness: 1, events: 1 });
  // An explicit refresh asks again, but the same answer is not announced as a change.
  await readQuotaStatus(ctx, true);
  expect(calls).toEqual({ harness: 2, events: 1 });
});
