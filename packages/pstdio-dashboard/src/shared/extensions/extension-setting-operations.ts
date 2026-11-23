import type { ExtensionSettingDefinitionRecord, ExtensionSettingValueRecord } from "@pstdio/sdk/api";
import { PstdioApiError } from "@pstdio/sdk/client";
import { classifyApiWrite, getWorkbenchOperations, operationSubject } from "@pstdio/workbench";
import { hashKey } from "@tanstack/react-query";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { dashboardCommandIds } from "@/shared/app/commands";

export interface ExtensionSettingTarget {
  projectId?: string;
  instanceId?: string;
  installName?: string;
  installedExtensionId?: string;
}

export type SettingIdentity = Pick<ExtensionSettingDefinitionRecord, "key" | "scope" | "extensionId">;
type SettingsRead = {
  target: ExtensionSettingTarget;
  current(key: string): ExtensionSettingValueRecord | undefined;
  accept(record: ExtensionSettingValueRecord): void;
};
type SettingIntent = { value: unknown };
type SettingReadReceipt = {
  record: ExtensionSettingValueRecord;
  observed: ReadonlyMap<SettingsRead, ExtensionSettingValueRecord | undefined>;
};

const domain = "extension.setting";
const subjectFor = (target: ExtensionSettingTarget, setting: SettingIdentity) => {
  const { projectId, instanceId, installedExtensionId, installName } = target;
  const { scope, key, extensionId } = setting;
  if (scope === "device") return operationSubject(domain, scope, extensionId, key);
  if (scope === "global") return operationSubject(domain, scope, installedExtensionId ?? installName, key);
  return operationSubject(domain, scope, projectId, instanceId, key);
};

const sameValue = (left: unknown, right: unknown) =>
  Object.is(left, right) || (left !== undefined && right !== undefined && hashKey([left]) === hashKey([right]));

export const getExtensionSettingOperations = createRuntimeState((owner) => {
  const queries = getDashboardScopedQueries(owner);
  const operations = getWorkbenchOperations(queries);
  const api = getRuntimeApiClient(owner).extensions;
  const readers = new Set<SettingsRead>();
  const authority = () => {
    const { runtimeId, accountId, accountOrigin } = queries.getScope();
    return JSON.stringify([runtimeId, accountId, accountOrigin]);
  };
  const project = (target: ExtensionSettingTarget, record: ExtensionSettingValueRecord) => {
    const subject = subjectFor(target, record);
    const intent = operations
      .getSnapshot()
      .pending.reduce<SettingIntent | undefined>(
        (latest, entry) => (entry.subjects.includes(subject) ? (entry.intent as SettingIntent) : latest),
        undefined,
      );
    if (!intent) return record;
    const { value } = intent;
    return value === undefined
      ? { ...record, source: "default" as const, value: record.default }
      : { ...record, source: "stored" as const, value };
  };
  const transport = (target: ExtensionSettingTarget) => {
    const { projectId, instanceId, installName } = target;
    if (projectId && instanceId)
      return {
        get: (key: string) => api.projectSettings.get(projectId, instanceId, key),
        all: () => api.projectSettings.all(projectId, instanceId),
        set: (key: string, value: unknown) => api.projectSettings.set(projectId, instanceId, key, value),
        delete: (key: string) => api.projectSettings.delete(projectId, instanceId, key),
      };
    if (!installName) throw new Error("This extension setting has no active owner.");
    return {
      get: (key: string) => api.installedSettings.get(installName, key),
      all: () => api.installedSettings.all(installName),
      set: (key: string, value: unknown) => api.installedSettings.set(installName, key, value),
      delete: (key: string) => api.installedSettings.delete(installName, key),
    };
  };
  return {
    subscribe: operations.subscribe,
    snapshot: operations.getSnapshot,
    authority,
    project,
    transport,
    observe(reader: SettingsRead) {
      readers.add(reader);
      return () => {
        readers.delete(reader);
      };
    },
    async update(target: ExtensionSettingTarget, setting: SettingIdentity, value: unknown, assertCurrent: () => void) {
      assertCurrent();
      const subject = subjectFor(target, setting);
      if (
        operations
          .getSnapshot()
          .pending.some(
            (entry) =>
              entry.subjects.includes(subject) && (entry.status === "unknown" || entry.status === "unconfirmed"),
          )
      )
        throw new Error("This setting has an unfinished change. Check System activity.");
      const endpoint = transport(target);
      const read = async (signal: AbortSignal) => {
        signal.throwIfAborted();
        const observed = new Map(
          [...readers]
            .filter((reader) => subjectFor(reader.target, setting) === subject)
            .map((reader) => [reader, reader.current(setting.key)] as const),
        );
        const result = await endpoint.get(setting.key).catch((error: unknown) => {
          if (!(error instanceof PstdioApiError) || error.status !== 404 || setting.scope === "project") throw error;
          signal.throwIfAborted();
          // A device or installed-global setting can outlive the project that wrote it.
          const peer = [...observed].find(
            ([reader, current]) =>
              readers.has(reader) &&
              current &&
              subjectFor(reader.target, current) === subject &&
              (reader.target.projectId !== target.projectId ||
                reader.target.instanceId !== target.instanceId ||
                reader.target.installName !== target.installName),
          );
          if (!peer) throw error;
          return transport(peer[0].target).get(setting.key);
        });
        if (result.key !== setting.key || result.scope !== setting.scope || result.extensionId !== setting.extensionId)
          throw new SyntaxError("The extension returned a different setting.");
        return { record: result, observed };
      };
      return operations.submit<{ verified?: SettingReadReceipt; setting?: ExtensionSettingValueRecord }>({
        projectId: setting.scope === "project" ? target.projectId : undefined,
        domain,
        title: value === undefined ? "Reset extension setting" : "Update extension setting",
        subjects: [subject],
        sourceCommand: { id: dashboardCommandIds.openExtensions },
        draft: { key: setting.key, extensionId: setting.extensionId },
        intent: { value } satisfies SettingIntent,
        classify: classifyApiWrite,
        async write(signal) {
          signal.throwIfAborted();
          assertCurrent();
          if (value !== undefined) return { setting: await endpoint.set(setting.key, value) };
          await endpoint.delete(setting.key);
          return {};
        },
        async reconcile(receipt, signal) {
          const { record, observed } = receipt.verified ?? (await read(signal));
          signal.throwIfAborted();
          for (const [reader, before] of observed) {
            const current = readers.has(reader) ? reader.current(record.key) : undefined;
            if (
              !current ||
              !before ||
              subjectFor(reader.target, current) !== subject ||
              current.source !== before.source ||
              !sameValue(current.value, before.value)
            )
              continue;
            reader.accept({
              ...current,
              source: record.source,
              value: record.source === "default" ? current.default : record.value,
            });
          }
        },
        async check(signal) {
          const verified = await read(signal);
          const { record } = verified;
          const matches =
            value === undefined
              ? record.source === "default"
              : record.source === "stored" && sameValue(record.value, value);
          return matches ? { status: "confirmed", result: { verified, setting: record } } : { status: "unknown" };
        },
      }).result;
    },
  };
});
