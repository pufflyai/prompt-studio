import { type OperationSourceCommand, operationSubject, type WorkbenchOperations } from "@pstdio/workbench";
import type { UpdateChannel, UpdateChannelBridge } from "./update-channel-bridge";

const domain = "desktop.update-channel";
const subject = operationSubject("desktop", "update-channel");

export const projectUpdateChannel = (operations: WorkbenchOperations, confirmed?: UpdateChannel | null) =>
  operations
    .getSnapshot()
    .pending.reduce<UpdateChannel | null | undefined>(
      (channel, entry) =>
        entry.domain === domain && (entry.intent === "stable" || entry.intent === "nightly") ? entry.intent : channel,
      confirmed,
    );

export const changeUpdateChannel = (input: {
  operations: WorkbenchOperations;
  bridge: UpdateChannelBridge;
  channel: UpdateChannel;
  sourceCommand: OperationSourceCommand;
  accept(confirmed: UpdateChannel | null, signal: AbortSignal): Promise<void>;
}) =>
  input.operations.submit({
    domain,
    subjects: [subject],
    title: "Change update channel",
    intent: input.channel,
    draft: input.channel,
    sourceCommand: input.sourceCommand,
    write: () => input.bridge.setUpdateChannel(input.channel),
    async reconcile(_result, signal) {
      const confirmed = await input.bridge.getUpdateChannel();
      signal.throwIfAborted();
      await input.accept(confirmed, signal);
    },
    async check(signal) {
      const confirmed = await input.bridge.getUpdateChannel();
      signal.throwIfAborted();
      if (confirmed === input.channel) return { status: "confirmed", result: undefined };
      return { status: "unknown" };
    },
  }).result;
