import { closeSync, fsyncSync, openSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import * as Y from "yjs";
import {
  type CheckpointGroup,
  type DocumentRotation,
  documentPositionSchema,
  documentRotationSchema,
  liveFrameSchema,
  recoveryFileSchema,
  validateCheckpoint,
} from "../checkpoint";
import { canonicalJson } from "../fingerprint";
import type { Scope } from "../wire";

interface FrozenDocument {
  identity: string;
  revision: number;
  update: string;
  vector: string;
  group: CheckpointGroup | null;
  projectionBaseline: string;
}
interface Recovery {
  protocolVersion: 2;
  scope: Scope;
  recordId: string;
  epoch: string;
  generation: number;
  revision: number;
  checkpointRevision: number;
  state: string;
  checkpointVector: string;
  projectionBaseline: string;
  frozen: FrozenDocument | null;
}
const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
const decode = (bytes: string) => Buffer.from(bytes, "base64");

function replace(path: string, state: Recovery, fault?: string) {
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    const file = openSync(temporary, "wx", 0o600);
    try {
      writeFileSync(file, JSON.stringify(state));
      fsyncSync(file);
    } finally {
      closeSync(file);
    }
    if (fault === "before-rename") throw new Error("recovery replacement failed");
    renameSync(temporary, path);
    const directory = openSync(dirname(path), "r");
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
  } finally {
    rmSync(temporary, { force: true });
  }
}

// POSIX reference for the host-owned, replaceable recovery file. No relay durable acknowledgement.
export async function openDocumentSession(input: {
  path: string;
  scope: Scope;
  recordId: string;
  epoch: string;
  generation: number;
}) {
  const { path: _path, ...identity } = input;
  let recovery: Recovery = {
    protocolVersion: 2,
    ...identity,
    revision: 0,
    checkpointRevision: 0,
    state: "",
    checkpointVector: encode(new Uint8Array([0])),
    projectionBaseline: "",
    frozen: null,
  };
  try {
    recovery = recoveryFileSchema.parse(JSON.parse(await readFile(input.path, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (
    canonicalJson(recovery.scope) !== canonicalJson(input.scope) ||
    recovery.recordId !== input.recordId ||
    recovery.epoch !== input.epoch ||
    recovery.generation !== input.generation
  )
    throw new Error("Recovery belongs to another scope, epoch or document generation; preserve it as a proposal");
  let doc = new Y.Doc();
  if (recovery.state) Y.applyUpdate(doc, decode(recovery.state));
  let queue = Promise.resolve();
  const run = <T>(action: () => Promise<T>) => {
    const result = queue.then(action);
    queue = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  async function change(edit: (candidate: Y.Doc) => void, fault?: string) {
    const before = Y.encodeStateAsUpdate(doc);
    try {
      edit(doc);
      const next = { ...recovery, revision: recovery.revision + 1, state: encode(Y.encodeStateAsUpdate(doc)) };
      await replace(input.path, next, fault);
      recovery = next;
    } catch (error) {
      doc.destroy();
      doc = new Y.Doc();
      Y.applyUpdate(doc, before);
      throw error;
    }
  }
  return {
    transact: (edits: ({ index: number; text: string } | { index: number; count: number })[]) =>
      run(() =>
        change((candidate) => {
          candidate.transact(() => {
            for (const edit of edits) {
              if ("text" in edit) candidate.getText("body").insert(edit.index, edit.text);
              else candidate.getText("body").delete(edit.index, edit.count);
            }
          });
        }),
      ),
    edit: (index: number, text: string, fault?: string) =>
      run(() => change((candidate) => candidate.getText("body").insert(index, text), fault)),
    remove: (index: number, count: number) =>
      run(() => change((candidate) => candidate.getText("body").delete(index, count))),
    text: () => doc.getText("body").toString(),
    state: () => Y.encodeStateAsUpdate(doc),
    vector: () => Y.encodeStateVector(doc),
    position: (index: number) => ({
      scope: input.scope,
      epoch: recovery.epoch,
      documentId: recovery.recordId,
      generation: recovery.generation,
      position: encode(Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(doc.getText("body"), index))),
    }),
    resolvePosition: (inputPosition: unknown) => {
      const position = documentPositionSchema.parse(inputPosition);
      if (
        canonicalJson(position.scope) !== canonicalJson(recovery.scope) ||
        position.epoch !== recovery.epoch ||
        position.documentId !== recovery.recordId ||
        position.generation !== recovery.generation
      )
        throw new Error("Position belongs to another document generation");
      return (
        Y.createAbsolutePositionFromRelativePosition(Y.decodeRelativePosition(decode(position.position)), doc)?.index ??
        null
      );
    },
    revision: () => ({ current: recovery.revision, checkpoint: recovery.checkpointRevision }),
    diff: (vector: Uint8Array) => ({
      protocolVersion: 2 as const,
      scope: input.scope,
      epoch: input.epoch,
      documentId: input.recordId,
      generation: recovery.generation,
      kind: "update" as const,
      payload: encode(Y.encodeStateAsUpdate(doc, vector)),
    }),
    receive: (inputFrame: unknown) =>
      run(async () => {
        const frame = liveFrameSchema.parse(inputFrame);
        if (
          canonicalJson(frame.scope) !== canonicalJson(input.scope) ||
          frame.epoch !== recovery.epoch ||
          frame.documentId !== recovery.recordId ||
          frame.generation !== recovery.generation ||
          frame.kind !== "update"
        )
          throw new Error("Live scope or generation mismatch; resynchronize");
        await change((candidate) => Y.applyUpdate(candidate, decode(frame.payload)));
      }),
    freeze: () =>
      run(async () => {
        if (!recovery.frozen) {
          const frozen = {
            identity: crypto.randomUUID(),
            revision: recovery.revision,
            update: encode(Y.encodeStateAsUpdate(doc, decode(recovery.checkpointVector))),
            vector: encode(Y.encodeStateVector(doc)),
            group: null,
            projectionBaseline: recovery.projectionBaseline,
          };
          const next = { ...recovery, frozen };
          await replace(input.path, next);
          recovery = next;
        }
        return structuredClone(recovery.frozen!);
      }),
    prepare: (inputGroup: CheckpointGroup, projectionBaseline: string) =>
      run(async () => {
        const group = await validateCheckpoint(inputGroup);
        const frozen = recovery.frozen;
        const delta = group.changes.find((change) => change.recordId === recovery.recordId)?.shared;
        if (
          !frozen ||
          group.document.recoveryRevision !== frozen.revision ||
          group.document.generation !== recovery.generation ||
          group.document.recordId !== recovery.recordId ||
          group.epoch !== recovery.epoch ||
          canonicalJson(group.scope) !== canonicalJson(recovery.scope) ||
          delta?.kind !== "text" ||
          delta.update !== frozen.update
        )
          throw new Error("Prepared checkpoint does not match the frozen recovery revision");
        if (
          frozen.group &&
          (frozen.group.fingerprint !== group.fingerprint || frozen.projectionBaseline !== projectionBaseline)
        )
          throw new Error("Frozen checkpoint identity cannot change");
        const next = { ...recovery, frozen: { ...frozen, group, projectionBaseline } };
        await replace(input.path, next);
        recovery = next;
        return group;
      }),
    complete: (revision: number, acceptedFingerprint: string) =>
      run(async () => {
        if (revision <= recovery.checkpointRevision) return;
        if (recovery.frozen?.revision !== revision || recovery.frozen.group?.fingerprint !== acceptedFingerprint)
          throw new Error("Checkpoint does not consume this prepared recovery revision");
        const next = {
          ...recovery,
          checkpointRevision: revision,
          checkpointVector: recovery.frozen.vector,
          projectionBaseline: recovery.frozen.projectionBaseline,
          frozen: null,
        };
        await replace(input.path, next);
        recovery = next;
      }),
    rebase: (inputRotation: DocumentRotation) =>
      run(async () => {
        const rotation = documentRotationSchema.parse(inputRotation);
        if (
          canonicalJson(rotation.scope) !== canonicalJson(recovery.scope) ||
          rotation.epoch !== recovery.epoch ||
          rotation.documentId !== recovery.recordId ||
          recovery.frozen ||
          recovery.revision !== recovery.checkpointRevision ||
          rotation.previousGeneration !== recovery.generation
        )
          throw new Error("Generation barrier incomplete");
        const fresh = new Y.Doc();
        Y.applyUpdate(fresh, decode(rotation.seed));
        if (fresh.getText("body").toString() !== doc.getText("body").toString()) {
          fresh.destroy();
          throw new Error("Generation barrier does not cover local text");
        }
        const next = {
          ...recovery,
          generation: rotation.generation,
          state: encode(Y.encodeStateAsUpdate(fresh)),
          checkpointVector: encode(Y.encodeStateVector(fresh)),
        };
        try {
          await replace(input.path, next);
        } catch (error) {
          fresh.destroy();
          throw error;
        }
        doc.destroy();
        doc = fresh;
        recovery = next;
      }),
    close: () => doc.destroy(),
  };
}
