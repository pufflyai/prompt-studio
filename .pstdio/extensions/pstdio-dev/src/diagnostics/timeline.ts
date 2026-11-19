import { homedir } from "node:os";
import { join } from "node:path";

export interface StartupStep {
  phase: string;
  /** Milliseconds from process start to the end of this step. */
  atMs: number;
  durationMs: number;
}

export interface SetupStep {
  phase: string;
  /** Milliseconds from the start of its project setup. */
  startMs: number;
  durationMs: number | null;
  state: "completed" | "failed" | "running";
  depth: number;
}

export interface ProjectSetup {
  projectId: string;
  startedAt: string;
  durationMs: number | null;
  outcome: "completed" | "failed" | "interrupted" | "running";
  steps: SetupStep[];
}

export interface Launch {
  id: string;
  startedAt: string;
  /** Process start to `app_ready`, or null when the runtime never became ready. */
  readyMs: number | null;
  startup: StartupStep[];
  setups: ProjectSetup[];
  endedAt: string | null;
  ended: "quit" | "unknown" | "running";
}

interface LogLine {
  time: string;
  autostartId?: string;
  event?: string;
  phase?: string;
  state?: string;
  elapsedMs?: number;
  duration_ms?: number;
  span_id?: string;
  project_id?: string;
}

interface OpenSetup extends ProjectSetup {
  start: number;
  spans: Map<string, SetupStep>;
}

interface OpenLaunch extends Omit<Launch, "setups"> {
  setups: OpenSetup[];
  open: OpenSetup[];
  lastElapsed: number;
}

// The final setup step; its end means the project folder is ready.
const LAST_SETUP_STEP = "project.provision";
const FIRST_SETUP_STEP = "project.config";
const READ_LIMIT_BYTES = 64 * 1024 * 1024;

export const pstdioHome = () => process.env.PSTDIO_HOME?.trim() || join(homedir(), ".pstdio");

const finishSetup = (setup: OpenSetup, outcome: ProjectSetup["outcome"], at: number) => {
  setup.outcome = outcome;
  if (outcome !== "running") setup.durationMs = at - setup.start;
  for (const step of setup.steps) if (step.state === "running" && outcome !== "running") step.state = "failed";
};

const parseLine = (text: string) => {
  if (!text.includes('"runtime.')) return null;
  try {
    const line = JSON.parse(text) as LogLine;
    const at = Date.parse(line.time);
    return Number.isNaN(at) || !line.phase ? null : { line: line as LogLine & { phase: string }, at };
  } catch {
    return null;
  }
};

const closeLaunch = (launch: OpenLaunch, ended: "quit" | "unknown", at: number, endedAt: string | null) => {
  launch.ended = ended;
  launch.endedAt = endedAt;
  for (const setup of launch.open) finishSetup(setup, "interrupted", at);
  launch.open = [];
};

const startLaunch = (launches: OpenLaunch[], time: string, elapsedMs = 0) => {
  const start = Date.parse(time) - elapsedMs;
  const previous = launches.at(-1);
  if (previous?.ended === "running") closeLaunch(previous, "unknown", start, null);
  const launch: OpenLaunch = {
    id: new Date(start).toISOString(),
    startedAt: new Date(start).toISOString(),
    readyMs: null,
    startup: [],
    setups: [],
    endedAt: null,
    ended: "running",
    open: [],
    lastElapsed: -1,
  };
  launches.push(launch);
  return launch;
};

const recordStartup = (launches: OpenLaunch[], line: LogLine & { phase: string; elapsedMs: number }) => {
  const current = launches.at(-1);
  // A process logs each startup step once, so a repeated step or a smaller elapsed time is a new process.
  const launch =
    !current ||
    current.ended !== "running" ||
    line.elapsedMs < current.lastElapsed ||
    current.startup.some((step) => step.phase === line.phase)
      ? startLaunch(launches, line.time, line.elapsedMs)
      : current;
  const previous = launch.startup.at(-1)?.atMs ?? 0;
  launch.startup.push({ phase: line.phase, atMs: line.elapsedMs, durationMs: line.elapsedMs - previous });
  launch.lastElapsed = line.elapsedMs;
  if (line.phase === "app_ready") launch.readyMs = line.elapsedMs;
};

const startSetupStep = (launch: OpenLaunch, line: LogLine & { phase: string; span_id: string }, at: number) => {
  let setup = line.project_id
    ? launch.open.find((candidate) => candidate.projectId === line.project_id)
    : launch.open.at(-1);
  if (line.phase === FIRST_SETUP_STEP && line.project_id) {
    if (setup) finishSetup(setup, "interrupted", at);
    launch.open = launch.open.filter((candidate) => candidate !== setup);
    setup = {
      projectId: line.project_id,
      startedAt: line.time,
      durationMs: null,
      outcome: "running",
      steps: [],
      start: at,
      spans: new Map(),
    };
    launch.open.push(setup);
    launch.setups.push(setup);
  }
  if (!setup) return;
  const depth = setup.steps.filter((step) => step.state === "running").length;
  const step: SetupStep = { phase: line.phase, startMs: at - setup.start, durationMs: null, state: "running", depth };
  setup.steps.push(step);
  setup.spans.set(line.span_id, step);
};

const finishSetupStep = (launch: OpenLaunch, line: LogLine & { phase: string; span_id: string }, at: number) => {
  const setup = launch.open.find((candidate) => candidate.spans.has(line.span_id));
  const step = setup?.spans.get(line.span_id);
  if (!setup || !step) return;
  step.durationMs = line.duration_ms ?? at - setup.start - step.startMs;
  step.state = line.state === "completed" ? "completed" : "failed";
  const outcome =
    step.state === "failed" && step.depth === 0 ? "failed" : line.phase === LAST_SETUP_STEP && "completed";
  if (!outcome) return;
  finishSetup(setup, outcome, at);
  launch.open = launch.open.filter((candidate) => candidate !== setup);
};

const record = (launches: OpenLaunch[], line: LogLine & { phase: string }, at: number) => {
  const current = launches.at(-1);
  if (line.event === "runtime.startup.phase" && typeof line.elapsedMs === "number") {
    recordStartup(launches, { ...line, elapsedMs: line.elapsedMs });
    return;
  }
  if (line.event === "runtime.shutdown.phase") {
    const settled = line.phase === "database" && line.state === "settled";
    if (current?.ended === "running" && settled) closeLaunch(current, "quit", at, line.time);
    return;
  }
  if (line.event !== "runtime.setup.phase" || !line.span_id) return;
  const launch = current?.ended === "running" ? current : startLaunch(launches, line.time);
  const step = { ...line, span_id: line.span_id };
  if (line.state === "started") startSetupStep(launch, step, at);
  else finishSetupStep(launch, step, at);
};

/** Groups runtime phase logs into launches, each with its startup steps and project setups. */
export const buildTimeline = (lines: Iterable<string>, limit = 60) => {
  const launchesByProcess = new Map<string | undefined, OpenLaunch[]>();
  for (const text of lines) {
    const parsed = parseLine(text);
    if (!parsed) continue;
    const processId = parsed.line.autostartId;
    const launches = launchesByProcess.get(processId) ?? [];
    record(launches, parsed.line, parsed.at);
    launchesByProcess.set(processId, launches);
  }
  return [...launchesByProcess]
    .flatMap(([processId, launches]) =>
      launches.map((launch) => ({ ...launch, id: processId ? `${processId}:${launch.id}` : launch.id })),
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit)
    .map(
      ({ open: _open, lastElapsed: _lastElapsed, setups, ...launch }): Launch => ({
        ...launch,
        setups: setups.map(({ start: _start, spans: _spans, ...setup }) => setup),
      }),
    );
};

/** Reads the newest part of the runtime log; the log is append-only and never rotated. */
export const readTimeline = async (
  logPath = process.env.PSTDIO_LOG_PATH?.trim() || join(pstdioHome(), "logs.jsonl"),
) => {
  const file = Bun.file(logPath);
  if (!(await file.exists())) return { logPath, launches: [] as Launch[] };
  const text = await file.slice(Math.max(0, file.size - READ_LIMIT_BYTES)).text();
  return { logPath, launches: buildTimeline(text.split("\n")) };
};
