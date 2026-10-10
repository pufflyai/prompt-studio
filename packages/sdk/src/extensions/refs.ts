import type {
  ArtifactChangedPayload,
  CommandLifecycleEventPayload,
  CommandLifecyclePhase,
  CommandRef,
  EventRef,
  Struct,
} from "pstdio-api-contracts/extension-kernel";

export { commandRef, eventRef } from "pstdio-api-contracts/extension-kernel";

/**
 * Build an `EventRef` for a command lifecycle phase (`requested`, `started`, `completed`,
 * `rejected`, `failed`). The payload type is inferred from the command ref so hooks see
 * the correct shape.
 */
export const commandEvent = <TPhase extends CommandLifecyclePhase, TParams extends Struct = Struct, TResult = unknown>(
  command: CommandRef<TParams, TResult>,
  phase: TPhase,
): EventRef<CommandLifecycleEventPayload<TPhase, TParams, TResult>> => ({
  ...(command.extensionId ? { extensionId: command.extensionId } : {}),
  kind: "event",
  id: `command.${phase}:${command.id}`,
});

/**
 * Build the `EventRef` the host emits when files in a watched artifact mount change outside the
 * mount API. Pass the value returned by `defineArtifactMount`, or `{ id, extensionId }` for
 * another extension's mount.
 */
export const artifactChanged = (mount: { id: string; extensionId?: string }): EventRef<ArtifactChangedPayload> => ({
  ...(mount.extensionId ? { extensionId: mount.extensionId } : {}),
  kind: "event",
  id: `artifact.changed:${mount.id}`,
});
