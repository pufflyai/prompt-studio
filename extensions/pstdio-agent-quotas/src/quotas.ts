import { type CommandContext, commandRef } from "@pstdio/sdk/extensions";
import { type ProviderQuotas, type QuotaLimit, type QuotaStatus, quotasChanged } from "./shared";

type QuotaSnapshot = Omit<ProviderQuotas, "id" | "label" | "short">;

// Every harness extension exposes the same `quotas` command. Order sets the default selection.
export const providers = [
  ["harness-claude-code", "Claude Code", "Claude"],
  ["harness-codex", "Codex", "Codex"],
  ["harness-copilot", "GitHub Copilot", "Copilot"],
  ["harness-open-code", "OpenCode", "OpenCode"],
  ["harness-pi", "Pi", "Pi"],
].map(([name, label, short]) => ({
  id: name!,
  label: label!,
  short: short!,
  extensionId: `pstdio.${name}`,
  command: commandRef.forExtension({ publisher: "pstdio", name: name! })<Record<string, never>, QuotaSnapshot>(
    "quotas",
  ),
}));
export type Provider = (typeof providers)[number];

/** A read starts a short-lived agent process, so reuse a snapshot for this long. */
export const STALE_MS = 5 * 60_000;

const SNAPSHOTS = "quotas";
const SETTINGS = "settings";
const SELECTION = "selection";
const ENABLED = "enabled";

const isLimit = (limit: unknown): limit is QuotaLimit => {
  const value = limit as QuotaLimit;
  return (
    !!value &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    Number.isFinite(value.remainingPercent) &&
    (value.resetsAt === undefined || Number.isFinite(Date.parse(value.resetsAt)))
  );
};

export const isSnapshot = (value: unknown): value is QuotaSnapshot => {
  const snapshot = value as QuotaSnapshot;
  return (
    !!snapshot &&
    ["available", "unavailable", "unsupported"].includes(snapshot.status) &&
    typeof snapshot.checkedAt === "string" &&
    Array.isArray(snapshot.limits) &&
    snapshot.limits.every(isLimit)
  );
};

/** A failed or empty reading is reused this long, so a harness without data is not asked on every view read. */
export const UNAVAILABLE_STALE_MS = 60_000;

/**
 * An available reading is reused for five minutes, but never past a reset: its numbers belong to the old
 * window. A reading without data is reused for a minute.
 */
export const isFresh = (cached: ProviderQuotas | undefined, now: number) => {
  if (!cached) return false;
  const age = now - Date.parse(cached.checkedAt);
  if (cached.status !== "available") return age < UNAVAILABLE_STALE_MS;
  return (
    age < STALE_MS && !cached.limits.some((limit) => limit.resetsAt !== undefined && Date.parse(limit.resetsAt) <= now)
  );
};

/** Whether two readings show the same thing. `checkedAt` is ignored: a repeat of the same answer is not a change. */
export const sameReading = (a: ProviderQuotas | undefined, b: ProviderQuotas) =>
  !!a && JSON.stringify({ ...a, checkedAt: "" }) === JSON.stringify({ ...b, checkedAt: "" });

/** The saved choice while it is still on, otherwise the first provider that is on. */
export const chooseProvider = <T extends { id: string }>(enabled: readonly T[], saved: string | undefined) =>
  enabled.find((provider) => provider.id === saved) ?? enabled[0];

type Ctx = Pick<CommandContext, "commands" | "storage" | "events" | "signal" | "extensions">;

interface EnabledRecord {
  ids: string[];
  checkedAt: string;
}

/** Listing extensions takes seconds on a busy host, so the views' minute refresh reuses the last list. */
export const ENABLED_STALE_MS = 5 * 60_000;
const LIST_TIMEOUT_MS = 5_000;

/** Ids of harness extensions that are turned on and loaded, or undefined when the host did not answer in time. */
const listEnabled = async (ctx: Ctx): Promise<string[] | undefined> => {
  if (!ctx.extensions) return undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const inventory = await Promise.race([
      ctx.extensions.list(),
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), LIST_TIMEOUT_MS);
      }),
    ]);
    return inventory?.extensions
      .filter((extension) => extension.enabled && extension.status === "loaded")
      .map((extension) => extension.extensionId);
  } catch {
    ctx.signal?.throwIfAborted();
    return undefined;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Which providers to offer: a fresh listing, else the last saved one, else every provider.
 * A slow or failed listing must not suddenly offer harnesses that are turned off.
 */
export const pickEnabled = (listed: string[] | undefined, saved: EnabledRecord | undefined) => {
  const ids = listed ?? saved?.ids;
  return ids ? providers.filter((provider) => ids.includes(provider.extensionId)) : providers;
};

/** Providers whose harness extension is turned on and loaded in this project. */
const enabledProviders = async (ctx: Ctx, refresh: boolean): Promise<Provider[]> => {
  const settings = ctx.storage.collection<EnabledRecord>(SETTINGS);
  const saved = await settings.get(ENABLED);
  if (!refresh && saved && Date.now() - Date.parse(saved.checkedAt) < ENABLED_STALE_MS) {
    return pickEnabled(undefined, saved);
  }
  const listed = await listEnabled(ctx);
  if (listed) await settings.put(ENABLED, { ids: listed, checkedAt: new Date().toISOString() });
  return pickEnabled(listed, saved);
};

const unavailable = (provider: Provider, message: string): ProviderQuotas => ({
  id: provider.id,
  label: provider.label,
  short: provider.short,
  status: "unavailable",
  checkedAt: new Date().toISOString(),
  limits: [],
  message,
});

const fetchProvider = async (ctx: Ctx, provider: Provider, previous: ProviderQuotas | undefined) => {
  let report: ProviderQuotas;
  try {
    const outcome = await ctx.commands.execute(provider.command, { params: {} });
    if (outcome.ok && isSnapshot(outcome.value)) {
      report = { id: provider.id, label: provider.label, short: provider.short, ...outcome.value };
    } else if (!outcome.ok && outcome.code === "command_not_found") {
      report = unavailable(provider, `${provider.label} is not turned on in this project.`);
    } else {
      report = unavailable(provider, "Could not read quotas.");
    }
  } catch {
    ctx.signal?.throwIfAborted();
    report = unavailable(provider, "Could not read quotas.");
  }
  // Save first, then tell views to refetch. Views reload on the event and may read again, so an
  // unchanged answer emits nothing: otherwise a harness without data would be asked in a loop.
  await ctx.storage.collection<ProviderQuotas>(SNAPSHOTS).put(provider.id, report);
  if (!sameReading(previous, report)) await ctx.events.emit(quotasChanged, { provider: provider.id });
  return report;
};

// Collapses simultaneous reads (meter and popover) into one harness call per provider.
const inFlight = new Map<string, Promise<ProviderQuotas>>();

const readProvider = async (ctx: Ctx, provider: Provider, refresh: boolean) => {
  const cached = await ctx.storage.collection<ProviderQuotas>(SNAPSHOTS).get(provider.id);
  if (!refresh && cached && isFresh(cached, Date.now())) return cached;
  let pending = inFlight.get(provider.id);
  if (!pending) {
    pending = fetchProvider(ctx, provider, cached).finally(() => inFlight.delete(provider.id));
    inFlight.set(provider.id, pending);
  }
  return pending;
};

const savedSelection = async (ctx: Ctx) =>
  (await ctx.storage.collection<{ provider: string }>(SETTINGS).get(SELECTION))?.provider;

/** Quotas for the selected provider only; the others are read when someone selects them. */
export const readQuotaStatus = async (ctx: Ctx, refresh = false): Promise<QuotaStatus> => {
  const [enabled, saved] = await Promise.all([enabledProviders(ctx, refresh), savedSelection(ctx)]);
  const provider = chooseProvider(enabled, saved);
  return {
    options: enabled.map(({ id, label }) => ({ id, label })),
    selected: provider ? await readProvider(ctx, provider, refresh) : undefined,
  };
};

export const selectProvider = async (ctx: Ctx, id: string): Promise<QuotaStatus> => {
  if (!providers.some((provider) => provider.id === id)) throw new Error(`Unknown provider: ${id}`);
  await ctx.storage.collection<{ provider: string }>(SETTINGS).put(SELECTION, { provider: id });
  await ctx.events.emit(quotasChanged, { provider: id });
  return readQuotaStatus(ctx);
};
