import type { Settings, UpdateSettingsInput } from "@pstdio/sdk/api";
import {
  classifyApiWrite,
  type OperationSourceCommand,
  operationSubject,
  type WorkbenchOperations,
} from "@pstdio/workbench";
import { updateSettingsInputSchema } from "pstdio-api-contracts";

interface SettingsOperationInput {
  operations: WorkbenchOperations;
  read(): Settings | undefined;
  accept(value: Settings): void;
  update(input: UpdateSettingsInput, signal: AbortSignal): Promise<Settings>;
  reload(signal: AbortSignal): Promise<Settings>;
}

const domain = "installation.settings";
const subject = operationSubject("settings", "global");

const collectPatches = (operations: ReturnType<WorkbenchOperations["getSnapshot"]>["pending"]) => {
  const patches: UpdateSettingsInput = {};
  const pending: UpdateSettingsInput = {};
  for (const operation of operations) {
    if (operation.domain !== domain || !operation.intent) continue;
    Object.assign(patches, operation.intent);
    if (operation.status !== "unknown" && operation.status !== "unconfirmed") {
      Object.assign(pending, operation.intent);
    }
  }
  return { patches, pending };
};

export const createSettingsOperations = (input: SettingsOperationInput) => {
  const { operations } = input;
  let snapshot: ReturnType<WorkbenchOperations["getSnapshot"]> | undefined;
  let patches: UpdateSettingsInput = {};
  let pending: UpdateSettingsInput = {};
  let lastBase: Settings | undefined;
  let projected: Settings | undefined;

  const sync = () => {
    const latest = operations.getSnapshot();
    const base = input.read();
    if (snapshot === latest && base === lastBase) return;
    if (snapshot !== latest) {
      snapshot = latest;
      ({ patches, pending } = collectPatches(latest.pending));
    }
    lastBase = base;
    projected = base && (Object.keys(patches).length ? { ...base, ...patches } : base);
  };

  return {
    read() {
      sync();
      return projected;
    },
    pending() {
      sync();
      return pending;
    },
    subscribe: operations.subscribe,
    latestRecovery(source: OperationSourceCommand) {
      return operations
        .getSnapshot()
        .recovery.slice()
        .reverse()
        .find(
          (entry) =>
            entry.domain === domain &&
            !entry.dismissed &&
            entry.sourceCommand?.id === source.id &&
            JSON.stringify(entry.sourceCommand.args) === JSON.stringify(source.args),
        );
    },
    dismiss: operations.dismiss,
    check: operations.check,
    submit(value: UpdateSettingsInput, sourceCommand?: OperationSourceCommand) {
      const patch = updateSettingsInputSchema.parse(value);
      return operations.submit({
        domain,
        subjects: [subject],
        title: "Change installation settings",
        sourceCommand,
        intent: patch,
        draft: patch,
        write: (signal) => input.update(patch, signal),
        async reconcile(_saved, signal) {
          const before = input.read();
          const result = await input.reload(signal);
          signal.throwIfAborted();
          // The live stream may have delivered a more recent settings snapshot during this request.
          if (before === input.read()) input.accept(result);
        },
        classify: classifyApiWrite,
      });
    },
  };
};
