import { relative, sep } from "node:path";
import type { HarnessHandle, HarnessRegistry } from "pstdio-api-runtime-host";
import type { RuntimeHarnessRecord } from "pstdio-extensions";
import { canonicalSourcePath } from "../extensions/project-extension-runtime-sources";

type Entry = { record: RuntimeHarnessRecord; handle: HarnessHandle };
type Scope = { entries: Map<string, Entry>; cleanup: Promise<void> };

const sameProvider = (left: RuntimeHarnessRecord, right: RuntimeHarnessRecord) => {
  if (left.sourcePath !== right.sourcePath || left.name !== right.name) return false;
  const { params: leftParams, ...leftDefinition } = left.provider;
  const { params: rightParams, ...rightDefinition } = right.provider;
  const keys = Object.keys(leftDefinition) as Array<keyof typeof leftDefinition>;
  return (
    keys.length === Object.keys(rightDefinition).length &&
    keys.every((key) => leftDefinition[key] === rightDefinition[key]) &&
    JSON.stringify(leftParams) === JSON.stringify(rightParams)
  );
};

const belongsToSource = (record: RuntimeHarnessRecord, sourcePath: string) => {
  const path = relative(canonicalSourcePath(sourcePath), canonicalSourcePath(record.sourcePath));
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !path.startsWith(sep));
};

// Handles, rather than catalog snapshots, own workers. Rebuilding view metadata
// must not close a healthy worker from an unchanged provider module.
export const createHarnessRegistryLifecycle = (build: (records: RuntimeHarnessRecord[]) => HarnessRegistry) => {
  const scopes = new Map<string | undefined, Scope>();
  let closed = false;
  let closing: Promise<void> | undefined;
  const ensureActive = () => {
    if (closed) throw new Error("Harness registry has been disposed.");
  };
  const scopeFor = (projectId?: string) => {
    let scope = scopes.get(projectId);
    if (!scope) {
      scope = { entries: new Map(), cleanup: Promise.resolve() };
      scopes.set(projectId, scope);
    }
    return scope;
  };

  const retire = (scope: Scope, entries: Entry[]) => {
    if (!entries.length) return;
    for (const entry of entries) scope.entries.delete(entry.record.id);
    // dispose marks each old handle closed synchronously. The barrier also waits
    // for earlier cleanup, so replacement workers cannot overlap retired ones.
    const disposals = entries.map(({ handle }) => handle.dispose());
    scope.cleanup = Promise.allSettled([scope.cleanup, ...disposals]).then((results) => {
      const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
      if (errors.length) throw new AggregateError(errors, "Harness worker cleanup failed.");
    });
    scope.cleanup.catch(() => {});
  };

  return {
    get: async (records: RuntimeHarnessRecord[], projectId?: string) => {
      ensureActive();
      const scope = scopeFor(projectId);
      const selected = new Map(records.map((record) => [record.id, record]));
      retire(
        scope,
        [...scope.entries.values()].filter(({ record }) => {
          const next = selected.get(record.id);
          return !next || !sameProvider(record, next);
        }),
      );
      for (;;) {
        const cleanup = scope.cleanup;
        await cleanup;
        if (cleanup === scope.cleanup) break;
      }
      ensureActive();
      const missing = records.filter((record) => !scope.entries.has(record.id));
      const added = build(missing);
      for (const record of missing) {
        const handle = added.get(record.id);
        if (handle) scope.entries.set(record.id, { record, handle });
      }
      const handles = records.flatMap((record) => {
        const entry = scope.entries.get(record.id);
        return entry ? [entry.handle] : [];
      });
      return {
        get: (id: string) => handles.find((handle) => handle.id === id) ?? null,
        list: () => handles,
        duplicates: added.duplicates,
        dispose: async () => {
          retire(scope, [...scope.entries.values()]);
          await scope.cleanup;
        },
      };
    },
    invalidate: (input: { projectId?: string; sourcePath?: string }) => {
      for (const [projectId, scope] of scopes) {
        if (input.projectId !== undefined && input.projectId !== projectId) continue;
        retire(
          scope,
          [...scope.entries.values()].filter(
            ({ record }) => !input.sourcePath || belongsToSource(record, input.sourcePath),
          ),
        );
      }
    },
    dispose: () => {
      closed = true;
      closing ??= (async () => {
        for (const scope of scopes.values()) retire(scope, [...scope.entries.values()]);
        const results = await Promise.allSettled([...scopes.values()].map((scope) => scope.cleanup));
        const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
        if (errors.length) throw new AggregateError(errors, "Harness registry cleanup failed.");
      })();
      return closing;
    },
  };
};
