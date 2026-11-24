import { type ResourceAnchor, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { classifyApiWrite, getWorkbenchOperations, operationSubject } from "@pstdio/workbench";
import { type ResourceLinkChange, type ResourceLinksService, resourceLinksCommandId } from "@pstdio/workbench/react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { getResourceLinkAuthority } from "./resource-link-authority";

const domain = "resource-links";

const bindsResource = (change: ResourceLinkChange, key: string) =>
  resourceKey(change.source) === key || change.targets.some((target) => resourceKey(target) === key);

export const getResourceLinkOperations = createRuntimeState((owner) => {
  const authority = getResourceLinkAuthority(owner);
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  const api = getRuntimeApiClient(owner).resources;
  let readId = 0;

  return (resource: ResourceRef): Pick<ResourceLinksService, "add" | "remove" | "changes"> => {
    const projectId = resource.projectId!;
    const key = resourceKey(resource);
    const authoritySignal = authority(projectId);
    const submit = async (change: ResourceLinkChange) => {
      authoritySignal.throwIfAborted();
      const { source, targets, kind } = change;
      if (!targets.length) return;
      const subjects = targets.map((target) => operationSubject(domain, resourceKey(source), resourceKey(target)));
      if (
        operations
          .getSnapshot()
          .pending.some(
            ({ status, subjects: held }) =>
              (status === "unknown" || status === "unconfirmed") && held.some((subject) => subjects.includes(subject)),
          )
      )
        throw new Error("An earlier link change is unconfirmed. Check System activity for recovery.");
      return operations.submit({
        projectId,
        domain,
        subjects,
        intent: change,
        showPending: true,
        title: kind === "add" ? "Link resource" : "Remove resource links",
        source: resource,
        sourceCommand: { id: resourceLinksCommandId, args: { resource } },
        draft: change,
        classify: classifyApiWrite,
        write() {
          authoritySignal.throwIfAborted();
          return kind === "add"
            ? api.addAnchors(projectId, source, targets)
            : api.removeAnchors(projectId, source, targets);
        },
        async check(signal) {
          authoritySignal.throwIfAborted();
          const page = await api.queryAnchors(projectId, { resource: source, direction: "outgoing", limit: 100 });
          signal.throwIfAborted();
          authoritySignal.throwIfAborted();
          const saved = new Map(
            page.items
              .filter((edge) => resourceKey(edge.source) === resourceKey(source))
              .map((edge) => [resourceKey(edge.target), edge.target]),
          );
          // A partial page can prove an edge is present. Absence requires a complete read.
          const confirmed =
            change.kind === "remove"
              ? !page.nextCursor && change.targets.every((target) => !saved.has(resourceKey(target)))
              : change.targets.every((target) => {
                  const stored = saved.get(resourceKey(target));
                  return stored?.role === (target.role ?? "context");
                });
          return confirmed ? { status: "confirmed", result: undefined } : { status: "unknown" };
        },
      }).result;
    };

    let observed: ReturnType<typeof operations.getSnapshot> | undefined;
    let changes: ReturnType<NonNullable<ResourceLinksService["changes"]>["getSnapshot"]> = [];
    const retired: typeof changes = [];
    const getSnapshot = () => {
      if (authoritySignal.aborted) return retired;
      const snapshot = operations.getSnapshot();
      if (snapshot === observed) return changes;
      observed = snapshot;
      const next = snapshot.pending
        .filter(({ domain: id, projectId: project, intent }) => id === domain && project === projectId && intent)
        .flatMap(({ id, status, intent }) => {
          const change = intent as ResourceLinkChange;
          return bindsResource(change, key) ? [{ id, status, change }] : [];
        });
      if (
        next.length !== changes.length ||
        next.some(({ id, status }, index) => {
          const previous = changes[index];
          return previous?.id !== id || previous.status !== status;
        })
      )
        changes = next;
      return changes;
    };
    return {
      add: (source: ResourceRef, targets: ResourceAnchor[]) => submit({ source, targets, kind: "add" }),
      remove: (source: ResourceRef, targets: ResourceRef[]) => submit({ source, targets, kind: "remove" }),
      changes: {
        getSnapshot,
        subscribe: operations.subscribe,
        observe(refresh) {
          return operations.observeRead({
            key: `resource-links:${++readId}`,
            matches: (operation) =>
              !authoritySignal.aborted &&
              operation.domain === domain &&
              operation.projectId === projectId &&
              Boolean(operation.intent && bindsResource(operation.intent as ResourceLinkChange, key)),
            refresh,
          });
        },
      },
    };
  };
});
