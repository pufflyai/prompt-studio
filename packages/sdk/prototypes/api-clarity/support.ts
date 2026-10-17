import type { Notification } from "pstdio-api-contracts";
import type { ArtifactMount, CommandOutcome, ExtensionSessionSummary } from "pstdio-api-contracts/extension-kernel";
import { createMemoryRepoFiles } from "../../src/testing/memory-repo-files";
import type { AuthorStatus, NotifyInput } from "./contracts";

export const failure = (code: string) => Object.assign(new Error(code), { code });

export const rejection: Extract<CommandOutcome, { ok: false }> = {
  ok: false,
  status: "rejected",
  code: "stale_revision",
  reason: "The ticket changed. Your draft is preserved.",
  data: { recordId: "ticket-1" },
  diagnostics: [{ code: "conflict", message: "Compare the two versions.", severity: "warning" }],
};

export const createSupport = () => {
  const calls: string[] = [];
  const record = (operation: string) => calls.push(operation);
  const notifications = new Map<string, Notification>(
    ["review-1", "review-2", "other-1"].map((id) => [
      id,
      {
        id,
        projectId: "project-1",
        title: id,
        kind: "needs_review",
        status: "open",
        priority: "normal",
        source: "dashboard",
        origin: "extension",
        related: [],
        actions: [],
        dedupeKey: id.startsWith("review") ? "review" : "other",
        createdAt: "2026-10-17T12:00:00.000Z",
        updatedAt: "2026-10-17T12:00:00.000Z",
      },
    ]),
  );
  const setStatus = async (id: string, status: AuthorStatus) => {
    if (status !== "done" && status !== "dismissed") throw failure("unsupported_notification_status");
    record("notifications.setStatus");
    const existing = notifications.get(id);
    if (!existing) return null;
    const updated = { ...existing, status };
    notifications.set(id, updated);
    return updated;
  };
  const setStatusByKey = async (key: string, status: AuthorStatus) => {
    const selected = [...notifications.values()].filter((item) => item.dedupeKey === key);
    return (await Promise.all(selected.map((item) => setStatus(item.id, status)))).filter(
      (item): item is NonNullable<typeof item> => item !== null,
    );
  };
  const legacyResolve = async (input: NotifyInput) => {
    const status = input.status ?? "done";
    if (status === "expired") {
      const selected = input.id
        ? [notifications.get(input.id)].filter((item): item is Notification => Boolean(item))
        : [...notifications.values()].filter((item) => item.dedupeKey === input.dedupeKey);
      return selected.map((item) => {
        const updated = { ...item, status: "expired" as const };
        notifications.set(item.id, updated);
        return updated;
      });
    }
    if (input.id) {
      const updated = await setStatus(input.id, status);
      return updated ? [updated] : [];
    }
    if (input.dedupeKey) return setStatusByKey(input.dedupeKey, status);
    throw failure("notification_selector_required");
  };
  const browserResolve = async (input: NotifyInput) => {
    if (input.dedupeKey) {
      const selected = await legacyResolve({ dedupeKey: input.dedupeKey, status: input.status });
      return { resolved: selected.length, notifications: selected };
    }
    if (input.status === "expired") throw failure("expired_by_id_unsupported");
    const selected = await legacyResolve(input);
    if (!selected[0]) throw failure("notification_not_found");
    return selected[0];
  };

  let workspaceAvailable = true;
  const mounts = new Map<string, ReturnType<typeof createMemoryRepoFiles>>();
  const mount = (root: string, readOnly = false): ArtifactMount => {
    let files = mounts.get(root);
    if (!files) {
      files = createMemoryRepoFiles();
      mounts.set(root, files);
    }
    const target = files;
    return new Proxy(target, {
      get(object, key) {
        const method = Reflect.get(object, key);
        if (typeof method !== "function") return method;
        return async (...args: unknown[]) => {
          if (root === "current" && !workspaceAvailable) throw failure("current_workspace_unavailable");
          const path = args[0];
          if (typeof path === "string" && (/^(?:[/\\]|[A-Za-z]:)/.test(path) || path.split(/[/\\]/).includes("..")))
            throw failure("path_outside_root");
          if (readOnly && ["writeText", "writeBytes", "updateText", "delete"].includes(String(key)))
            throw failure("package_read_only");
          record(`files.${String(key)}`);
          return Reflect.apply(method, object, args);
        };
      },
    });
  };
  const roots = {
    package: mount("package", true),
    local: mount("local"),
    current: mount("current"),
    default: mount("default"),
    shared: mount("outputs"),
  };
  mounts.get("package")?.files.set("templates/report.md", new TextEncoder().encode("# Report template"));
  const shared = (id: string) => {
    if (id !== "outputs") throw failure("mount_not_declared");
    return roots.shared;
  };
  const sessions: ExtensionSessionSummary[] = Array.from({ length: 63 }, (_, index) => ({
    id: `session-${index}`,
    title: `Session ${index}`,
    status: index === 62 ? "in_progress" : "completed",
    archived: false,
    agent: null,
    last_selected_model: null,
    workspace_id: "workspace-1",
    original_session_id: null,
    created_at: `2026-10-17T12:00:${String(index % 60).padStart(2, "0")}.000Z`,
    updated_at: "2026-10-17T12:00:00.000Z",
    last_request_started: null,
    last_request_ended: null,
    anchors_json: [],
    usage: null,
  }));
  return {
    calls,
    record,
    notifications,
    setStatus,
    setStatusByKey,
    legacyResolve,
    browserResolve,
    roots,
    shared,
    mounts,
    sessions,
    unavailableWorkspace: () => {
      workspaceAvailable = false;
    },
  };
};

export const track = <T extends object>(label: string, target: T, calls: string[]) =>
  new Proxy(target, {
    get(object, key) {
      const method = Reflect.get(object, key);
      if (typeof method !== "function") return method;
      return (...args: unknown[]) => {
        if (key !== "id") calls.push(`${label}.${String(key)}`);
        return Reflect.apply(method, object, args);
      };
    },
  });
