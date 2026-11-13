import { expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import type { AutoBuildMode } from "../../data/auto-build-mode";
import { createAutoBuildProjection } from "./auto-build-projection";
import type { PlanClient } from "./use-plan";

type Value = Awaited<ReturnType<PlanClient["commands"]["auto-build.read"]>>;
const mode = (revision = "first", prompt = "Original") => ({
  revision,
  prompt,
  enabled: false,
  state: "stopped" as const,
  blockOnReview: false,
  requireMergedDependencies: true,
  eligible: { conjunction: "and" as const, rules: [] },
});
const value = (config: AutoBuildMode = mode(), ids = ["old"]) =>
  ({
    ...config,
    state: config.state ?? "stopped",
    supervisorModel: config.supervisorModel,
    reviewRequests: [],
    requestErrors: [],
    observations: [],
    waitingTickets: [],
    configurationError: null,
    supervisor: null,
    sessions: ids.map((id) => ({
      id,
      title: id,
      status: "in_progress" as const,
      archived: false,
      agent: null,
      last_selected_model: null,
      workspace_id: null,
      original_session_id: null,
      created_at: "2026-11-12T00:00:00Z",
      updated_at: "2026-11-12T00:00:00Z",
      last_request_started: null,
      last_request_ended: null,
      anchors_json: [],
      usage: null,
    })),
    capacity: { running: 0, limit: 1 },
    completed: false,
    matchingTicketCount: undefined,
    readyTicketCount: undefined,
    stuck: false,
    running: false,
    error: undefined,
  }) satisfies Value;
const fixture = () => {
  const root = createScopedQueryClient({ runtimeId: "planner-ack", extensionId: "pstdio.pstdio-planner" });
  const source = root.query({ id: "mode", read: async () => value() });
  source.accept(value());
  const projection = createAutoBuildProjection({
    getSnapshot: source.getSnapshot,
    subscribe: source.subscribe,
    isDisposed: source.isDisposed,
    read: source.read,
    refresh: async () => {
      source.invalidate();
      return source.read();
    },
  });
  const stop = projection.subscribe(() => {});
  return {
    source,
    projection,
    dispose: () => {
      stop();
      root.dispose();
    },
  };
};

test("an acknowledged configuration keeps canonical live fields without writing into the host source", () => {
  const f = fixture();
  try {
    const action = f.projection.begin();
    f.projection.accept(action, mode("saved", "Accepted"));
    expect(f.projection.getSnapshot().data?.prompt).toBe("Accepted");
    expect(f.source.getSnapshot().data?.prompt).toBe("Original");
    const projected = f.projection.getSnapshot();
    expect(f.projection.getSnapshot()).toBe(projected);
    f.source.accept(value(mode(), ["fresh"]));
    expect(f.projection.getSnapshot().data?.prompt).toBe("Accepted");
    expect(f.projection.getSnapshot().data?.sessions.map((session) => session.id)).toEqual(["fresh"]);
    f.projection.complete(action);
    expect(f.projection.getSnapshot().data?.prompt).toBe("Original");
  } finally {
    f.dispose();
  }
});

test("a late configuration acknowledgement cannot overwrite a newer peer configuration", () => {
  const f = fixture();
  try {
    const action = f.projection.begin();
    f.source.accept(value(mode("peer", "Newer peer")));
    f.projection.accept(action, mode("old-ack", "Older acknowledgement"));
    expect(f.projection.getSnapshot().data?.prompt).toBe("Newer peer");
  } finally {
    f.dispose();
  }
});

test("out-of-order acknowledgements and old catch-ups cannot replace the latest action", () => {
  const f = fixture();
  try {
    const older = f.projection.begin();
    const latest = f.projection.begin();
    f.projection.accept(latest, mode("newest", "Newest"));
    f.projection.accept(older, mode("older", "Older"));
    f.projection.complete(older);
    expect(f.projection.getSnapshot().data?.prompt).toBe("Newest");
  } finally {
    f.dispose();
  }
});

test("a failed catch-up retains its acknowledged configuration until canonical acceptance", () => {
  const f = fixture();
  try {
    const action = f.projection.begin();
    f.projection.accept(action, mode("saved", "Accepted"));
    f.source.reportError(new Error("Catch-up unavailable"));
    expect(f.projection.getSnapshot().data?.prompt).toBe("Accepted");
    expect(f.projection.getSnapshot().error?.message).toBe("Catch-up unavailable");
    f.source.accept(value(mode("saved", "Accepted"), ["latest"]));
    expect(f.projection.getSnapshot().data?.sessions.map((session) => session.id)).toEqual(["latest"]);
    expect(f.projection.getSnapshot().error).toBeUndefined();
  } finally {
    f.dispose();
  }
});

test("a peer configuration cycle with the same revision still fences an old acknowledgement", () => {
  const f = fixture();
  try {
    const action = f.projection.begin();
    f.source.accept(value({ ...mode(), enabled: true, state: "running" }));
    f.source.accept(value(mode()));
    f.projection.accept(action, { ...mode(), enabled: true, state: "running" });
    expect(f.projection.getSnapshot().data?.enabled).toBe(false);
  } finally {
    f.dispose();
  }
});

test("retiring the action owner or host authority prevents late acknowledgements", () => {
  const f = fixture();
  try {
    const action = f.projection.begin();
    f.projection.retire();
    f.projection.accept(action, mode("old", "Old"));
    expect(f.projection.getSnapshot().data?.prompt).toBe("Original");
    const pending = f.projection.begin();
    f.source.dispose();
    f.projection.accept(pending, mode("old", "Old"));
    expect(f.projection.getSnapshot().data).toBeUndefined();
  } finally {
    f.dispose();
  }
});
