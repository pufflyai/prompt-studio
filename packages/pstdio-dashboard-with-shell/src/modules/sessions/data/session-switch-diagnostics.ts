export interface SessionSwitchTrace {
  targetKey: string;
  startedAt: number;
  source: string;
}

interface CreateSessionSwitchDiagnosticEntryInput<TMetadata extends Record<string, unknown> = Record<string, never>> {
  trace: SessionSwitchTrace;
  step: string;
  now: number;
  durationMs?: number;
  metadata?: TMetadata;
}

interface SessionSwitchTraceInput {
  sessionId?: string | null;
  resourceUri?: string;
  source?: string;
  step?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

const activeTraces = new Map<string, SessionSwitchTrace>();

const roundTiming = (value: number) => Math.round(value * 100) / 100;

const getGlobalDiagnosticsFlag = () =>
  (globalThis as { __PSTDIO_SESSION_SWITCH_DIAGNOSTICS__?: boolean }).__PSTDIO_SESSION_SWITCH_DIAGNOSTICS__;

const getImportMetaEnv = () =>
  (import.meta as unknown as { env?: { DEV?: boolean; VITE_SESSION_SWITCH_DIAGNOSTICS?: string } }).env;

export const getSessionSwitchDiagnosticNow = () => globalThis.performance?.now() ?? Date.now();

export const createSessionSwitchTargetKey = (input: Pick<SessionSwitchTraceInput, "resourceUri" | "sessionId">) => {
  if (input.resourceUri) return input.resourceUri;
  if (input.sessionId) return `pstdio://sessions/${input.sessionId}`;
  return "pstdio://sessions";
};

export const isSessionSwitchDiagnosticsEnabled = () => {
  const flag = getGlobalDiagnosticsFlag();
  if (typeof flag === "boolean") return flag;

  const env = getImportMetaEnv();
  return env?.DEV === true || env?.VITE_SESSION_SWITCH_DIAGNOSTICS === "1";
};

export const createSessionSwitchDiagnosticEntry = <TMetadata extends Record<string, unknown> = Record<string, never>>(
  input: CreateSessionSwitchDiagnosticEntryInput<TMetadata>,
) => {
  const metadata = (input.metadata ?? {}) as TMetadata;
  return {
    target: input.trace.targetKey,
    source: input.trace.source,
    step: input.step,
    elapsedMs: roundTiming(input.now - input.trace.startedAt),
    ...(input.durationMs === undefined ? {} : { durationMs: roundTiming(input.durationMs) }),
    ...metadata,
  } as {
    target: string;
    source: string;
    step: string;
    elapsedMs: number;
    durationMs?: number;
  } & TMetadata;
};

const markSessionSwitchStep = (targetKey: string, step: string) => {
  globalThis.performance?.mark?.(`pstdio.session-switch.${targetKey}.${step}`);
};

const writeSessionSwitchDiagnostic = (entry: ReturnType<typeof createSessionSwitchDiagnosticEntry>) => {
  console.debug("[dashboard-with-shell] session switch", entry);
};

export const beginSessionSwitchTrace = (input: SessionSwitchTraceInput) => {
  if (!isSessionSwitchDiagnosticsEnabled()) return;

  const targetKey = createSessionSwitchTargetKey(input);
  const trace = {
    targetKey,
    startedAt: getSessionSwitchDiagnosticNow(),
    source: input.source ?? "unknown",
  };
  activeTraces.set(targetKey, trace);
  if (input.sessionId) activeTraces.set(createSessionSwitchTargetKey({ sessionId: input.sessionId }), trace);
  markSessionSwitchStep(targetKey, "start");
  writeSessionSwitchDiagnostic(createSessionSwitchDiagnosticEntry({ trace, step: "start", now: trace.startedAt }));
};

export const recordSessionSwitchStep = (input: SessionSwitchTraceInput & { step: string }) => {
  if (!isSessionSwitchDiagnosticsEnabled()) return;

  const targetKey = createSessionSwitchTargetKey(input);
  const now = getSessionSwitchDiagnosticNow();
  const trace = activeTraces.get(targetKey) ?? {
    targetKey,
    startedAt: now,
    source: input.source ?? "standalone",
  };

  markSessionSwitchStep(trace.targetKey, input.step);
  writeSessionSwitchDiagnostic(
    createSessionSwitchDiagnosticEntry({
      trace,
      step: input.step,
      now,
      durationMs: input.durationMs,
      metadata: input.metadata,
    }),
  );
};
