import { expect, test } from "bun:test";
import type { TextEditingEvent } from "pstdio-api-contracts/extension-kernel";
import { emitTextEvent } from "./events";

test("a disconnected text observer retains failures and each distinct close barrier", () => {
  const connection = {
    listeners: new Set<(event: TextEditingEvent) => void>(),
    buffered: new Map<string | symbol, TextEditingEvent>(),
  };
  const failure: TextEditingEvent = {
    type: "error",
    memberId: "member",
    handle: "handle",
    error: { code: "connection_reset", message: "Observation failed", retryable: true },
  };
  const close: TextEditingEvent = { type: "prepareClose", barrierId: "first" };
  const barrierFailure: TextEditingEvent = { ...failure, barrierId: "first" };
  const next: TextEditingEvent = { type: "prepareClose", barrierId: "next" };
  for (const event of [failure, close, close, barrierFailure, next]) emitTextEvent(connection, event);
  expect([...connection.buffered.values()]).toEqual([failure, close, barrierFailure, next]);
});

test("a disconnected observer replays coalesced full states in their member version order", () => {
  const connection = {
    listeners: new Set<(event: TextEditingEvent) => void>(),
    buffered: new Map<string | symbol, TextEditingEvent>(),
  };
  const presence: TextEditingEvent = {
    type: "presence",
    memberId: "member",
    handle: "handle",
    version: 1,
    participants: [],
  };
  const snapshot: TextEditingEvent = {
    type: "snapshot",
    memberId: "member",
    handle: "handle",
    version: 2,
    snapshot: { state: "", seedId: "seed", sourceSeedId: "source", revision: 1, editable: true },
  };
  const latest: TextEditingEvent = { ...presence, version: 3 };
  for (const event of [presence, snapshot, latest]) emitTextEvent(connection, event);
  expect([...connection.buffered.values()]).toEqual([snapshot, latest]);
});
