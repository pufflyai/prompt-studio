import {
  nativePresenceLimits,
  type TextEditingInitialMember,
  textEditingConnectionSchema,
  textEditingRequestSchema,
} from "pstdio-api-contracts";
import type { TextEditingRequest, TextEditingResult } from "pstdio-api-contracts/extension-kernel";
import { z } from "zod";
import { grantTextSource, validateTextGrant, validateTextPresentation } from "./admission";
import { textFailure, throwTextError } from "./errors";
import { failTextClose, prepareTextClose, textEventBufferKey } from "./events";
import { textHandleMember } from "./handles";
import { openTextMember } from "./member-open";
import { currentTextMembers } from "./member-ownership";
import { registerTextMember, releaseTextMember } from "./members";
import { observeTextMember } from "./observe";
import { requestOpenMember } from "./request-open-member";
import type { TextConnection, TextConnectionAddress, TextEditingDeps } from "./types";

export const createTextEditingService = (deps: TextEditingDeps) => {
  const connections = new Map<string, TextConnection>();
  const unclaimed = new Map<string, ReturnType<typeof setTimeout>>();
  let disposed = false;
  const admissions = new Set<Promise<unknown>>();
  const track = <T>(work: Promise<T>) => {
    admissions.add(work);
    return work.finally(() => admissions.delete(work));
  };
  const stopInvalidation = deps.catalog.subscribeInvalidation((input) => {
    for (const connection of connections.values())
      if (!input.projectId || input.projectId === connection.projectId)
        for (const member of connection.members.values()) member.refresh?.();
  });
  const connectionFor = (address: TextConnectionAddress, cleanup = false) => {
    const connection = connections.get(address.token);
    if (connection && connection.projectId !== address.projectId)
      throw textFailure("grant_invalid", "This text connection belongs to another project");
    if (!connection || (connection.disposed && !cleanup))
      throw textFailure("connection_expired", "This text connection is no longer available", true);
    clearTimeout(unclaimed.get(connection.token));
    unclaimed.delete(connection.token);
    return connection;
  };
  const cleanupConnection = async (connection: TextConnection) => {
    connection.disposed = true;
    failTextClose(connection, {
      code: "session_closed",
      message: "The text placement was disconnected",
      retryable: false,
    });
    for (const member of currentTextMembers(connection)) member.stop?.();
    await Promise.allSettled([...connection.pending]);
    const released = await Promise.allSettled(
      currentTextMembers(connection).map((member) => releaseTextMember(deps, connection, member)),
    );
    const failures = released.filter((result) => result.status === "rejected").map((result) => result.reason);
    if (failures.length) throw new AggregateError(failures, "Text room cleanup is incomplete");
    connection.listeners.clear();
    connection.buffered.clear();
    connections.delete(connection.token);
  };
  const closeMember = async (connection: TextConnection, handle: string) => {
    const id = textHandleMember(connection, handle);
    const member = currentTextMembers(connection).find((member) => member.handle === handle);
    if (!member && !connection.members.has(id)) return;
    if (!member) throw textFailure("session_closed", "This text handle has been replaced");
    await releaseTextMember(deps, connection, member);
  };
  const open = async (connection: TextConnection, input: Extract<TextEditingRequest, { operation: "open" }>) => {
    const member = connection.members.get(input.memberId);
    if (!member) throw textFailure("session_closed", "Register the member before opening its source");
    const result = await openTextMember(deps, connection, member, input);
    observeTextMember(deps, connection, member);
    return result;
  };
  const openSelected = async (connection: TextConnection, memberId: string) => {
    const token = connection.selected;
    if (!token) throw textFailure("grant_invalid", "This placement has no selected text source");
    const existing = connection.members.has(memberId);
    registerTextMember(connection, memberId);
    const admitted = connection.members.get(memberId);
    try {
      return await open(connection, { operation: "open", memberId, input: { grant: { token } } });
    } catch (error) {
      if (!existing && admitted && connection.members.get(memberId) === admitted)
        await releaseTextMember(deps, connection, admitted);
      throw error;
    }
  };
  const request = async (connection: TextConnection, input: TextEditingRequest) => {
    switch (input.operation) {
      case "register":
        await validateTextPresentation(deps, connection);
        return registerTextMember(connection, input.memberId);
      case "abandon": {
        await Promise.all(
          currentTextMembers(connection)
            .filter((member) => member.id === input.memberId)
            .map((member) => releaseTextMember(deps, connection, member)),
        );
        return;
      }
      case "current": {
        await validateTextPresentation(deps, connection);
        const grant = connection.selected ? connection.grants.get(connection.selected) : undefined;
        if (grant) await validateTextGrant(deps, connection, grant);
        return grant ? { token: grant.token } : undefined;
      }
      case "openSelected":
        return openSelected(connection, input.memberId);
      case "open":
        return open(connection, input);
      case "close":
        return closeMember(connection, input.handle);
      default:
        return requestOpenMember(deps, connection, input);
    }
  };
  const connect = async (projectId: string, value: unknown, initial?: TextEditingInitialMember) => {
    if (disposed) throw textFailure("session_closed", "The text service was closed");
    const input = textEditingConnectionSchema.parse(value);
    const connection: TextConnection = {
      projectId,
      token: crypto.randomUUID(),
      input,
      grants: new Map(),
      members: new Map(),
      releasing: new Map(),
      active: initial?.active ?? true,
      disposed: false,
      pending: new Set(),
      listeners: new Set(),
      buffered: new Map(),
    };
    await validateTextPresentation(deps, connection);
    if (input.target) {
      const grant = await grantTextSource(deps, connection, input.target);
      connection.selected = grant.token;
    }
    if (initial) {
      try {
        const opened = await openSelected(connection, initial.memberId);
        if (disposed) throw textFailure("session_closed", "The text service was closed");
        connections.set(connection.token, connection);
        // A lost admission response leaves no client with the token to release its room.
        const timer = setTimeout(() => {
          unclaimed.delete(connection.token);
          void track(cleanupConnection(connection)).catch(() => {});
        }, nativePresenceLimits.leaseMs);
        timer.unref?.();
        unclaimed.set(connection.token, timer);
        return { token: connection.token, opened };
      } catch (error) {
        // No client received this token; the service still owns any failed room cleanup.
        connections.set(connection.token, connection);
        await cleanupConnection(connection).catch(() => {});
        throw error;
      }
    }
    if (disposed) throw textFailure("session_closed", "The text service was closed");
    connections.set(connection.token, connection);
    return { token: connection.token };
  };
  return {
    connect: (...args: Parameters<typeof connect>) => track(connect(...args)),
    async request<Request extends TextEditingRequest>(address: TextConnectionAddress, value: Request) {
      try {
        const connection = connectionFor(address);
        const work = request(connection, textEditingRequestSchema.parse(value));
        connection.pending.add(work);
        try {
          return (await work) as TextEditingResult<Request>;
        } finally {
          connection.pending.delete(work);
        }
      } catch (error) {
        if (error instanceof z.ZodError) throw textFailure("invalid_frame", "Invalid text operation");
        return throwTextError(error);
      }
    },
    listen(
      address: TextConnectionAddress,
      listener: (event: import("pstdio-api-contracts/extension-kernel").TextEditingEvent) => void,
    ) {
      const connection = connectionFor(address);
      connection.listeners.add(listener);
      const barrier = connection.barrier;
      const bufferedBarrier =
        barrier && connection.buffered.has(textEventBufferKey({ type: "prepareClose", barrierId: barrier.id }));
      for (const event of connection.buffered.values()) listener(event);
      if (connection.barrier && !bufferedBarrier) listener({ type: "prepareClose", barrierId: connection.barrier.id });
      connection.buffered.clear();
      for (const member of connection.members.values()) observeTextMember(deps, connection, member);
      return () => {
        connection.listeners.delete(listener);
        if (!connection.listeners.size) for (const member of connection.members.values()) member.stop?.();
      };
    },
    prepareClose(address: TextConnectionAddress) {
      const connection = connectionFor(address);
      const barrier = prepareTextClose(connection);
      return Promise.all([
        barrier,
        ...[...connection.releasing.keys()].map((member) => releaseTextMember(deps, connection, member)),
      ]).then(() => {});
    },
    setActive(address: TextConnectionAddress, active: boolean) {
      const connection = connectionFor(address);
      connection.active = active;
      for (const member of connection.members.values()) {
        if (active) observeTextMember(deps, connection, member);
        else member.stop?.();
      }
    },
    disconnect(address: TextConnectionAddress) {
      return cleanupConnection(connectionFor(address, true));
    },
    async dispose() {
      disposed = true;
      stopInvalidation();
      for (const timer of unclaimed.values()) clearTimeout(timer);
      unclaimed.clear();
      await Promise.allSettled([...admissions]);
      const cleaned = await Promise.allSettled([...connections.values()].map(cleanupConnection));
      const failures = cleaned.filter((result) => result.status === "rejected").map((result) => result.reason);
      if (failures.length) throw new AggregateError(failures, "Text connection cleanup is incomplete");
    },
  };
};
