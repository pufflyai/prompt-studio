import { nativePresenceLimits, textEditingConnectionSchema, textEditingRequestSchema } from "pstdio-api-contracts";
import type { TextEditingRequest, TextEditingResult } from "pstdio-api-contracts/extension-kernel";
import { z } from "zod";
import { grantTextSource, validateTextGrant, validateTextPresentation } from "./admission";
import { textFailure, throwTextError } from "./errors";
import { emitTextEvent, failTextClose, prepareTextClose } from "./events";
import { textHandleMember } from "./handles";
import { openTextMember } from "./member-open";
import { roomAddress } from "./members";
import { observeTextMember } from "./observe";
import { requestOpenMember } from "./request-open-member";
import type { TextConnection, TextConnectionAddress, TextEditingDeps, TextMember } from "./types";

export const createTextEditingService = (deps: TextEditingDeps) => {
  const connections = new Map<string, TextConnection>();
  const stopInvalidation = deps.catalog.subscribeInvalidation((input) => {
    for (const connection of connections.values())
      if (!input.projectId || input.projectId === connection.projectId)
        for (const member of connection.members.values()) member.refresh?.();
  });
  const connectionFor = (address: TextConnectionAddress) => {
    const connection = connections.get(address.token);
    if (connection && connection.projectId !== address.projectId)
      throw textFailure("grant_invalid", "This text connection belongs to another project");
    if (!connection || connection.disposed)
      throw textFailure("connection_expired", "This text connection is no longer available", true);
    return connection;
  };
  const releaseMember = async (connection: TextConnection, member: TextMember) => {
    if (connection.members.get(member.id) === member) connection.members.delete(member.id);
    member.stop?.();
    await member.queue;
    if (member.room) await deps.documents.release(roomAddress(connection, member));
    if (
      member.grant &&
      connection.selected !== member.grant.token &&
      ![...connection.members.values()].some((value) => value.grant === member.grant)
    )
      connection.grants.delete(member.grant.token);
    connection.barrier?.waiting.delete(member);
    if (connection.barrier && !connection.barrier.waiting.size) connection.barrier.resolve();
  };
  const closeMember = async (connection: TextConnection, handle: string) => {
    const member = connection.members.get(textHandleMember(connection, handle));
    if (!member) return;
    if (member.handle !== handle) throw textFailure("session_closed", "This text handle has been replaced");
    await releaseMember(connection, member);
  };
  const register = (connection: TextConnection, memberId: string) => {
    if (connection.members.has(memberId)) return;
    if (connection.barrier && !connection.barrier.waiting.size)
      throw textFailure("session_closed", "This placement has completed close preparation");
    if (connection.members.size >= nativePresenceLimits.rooms)
      throw textFailure("capability_denied", "This placement has reached its text member limit");
    const member: TextMember = {
      id: memberId,
      handle: "",
      queue: Promise.resolve(),
      sequence: 0,
      version: 0,
      selection: null,
    };
    connection.members.set(memberId, member);
    connection.barrier?.waiting.add(member);
    if (connection.barrier) emitTextEvent(connection, { type: "prepareClose", barrierId: connection.barrier.id });
  };
  const request = async (connection: TextConnection, input: TextEditingRequest) => {
    switch (input.operation) {
      case "register":
        await validateTextPresentation(deps, connection);
        return register(connection, input.memberId);
      case "abandon": {
        const member = connection.members.get(input.memberId);
        if (member) await releaseMember(connection, member);
        return;
      }
      case "current": {
        await validateTextPresentation(deps, connection);
        const grant = connection.selected ? connection.grants.get(connection.selected) : undefined;
        if (grant) await validateTextGrant(deps, connection, grant);
        return grant ? { token: grant.token } : undefined;
      }
      case "open": {
        const member = connection.members.get(input.memberId);
        if (!member) throw textFailure("session_closed", "Register the member before opening its source");
        const result = await openTextMember(deps, connection, member, input);
        observeTextMember(deps, connection, member);
        return result;
      }
      case "close":
        return closeMember(connection, input.handle);
      default:
        return requestOpenMember(deps, connection, input);
    }
  };
  return {
    async connect(projectId: string, value: unknown) {
      const input = textEditingConnectionSchema.parse(value);
      const connection: TextConnection = {
        projectId,
        token: crypto.randomUUID(),
        input,
        grants: new Map(),
        members: new Map(),
        active: true,
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
      connections.set(connection.token, connection);
      return { token: connection.token };
    },
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
      for (const event of connection.buffered.values()) listener(event);
      connection.buffered.clear();
      for (const member of connection.members.values()) observeTextMember(deps, connection, member);
      return () => {
        connection.listeners.delete(listener);
        if (!connection.listeners.size) for (const member of connection.members.values()) member.stop?.();
      };
    },
    prepareClose(address: TextConnectionAddress) {
      return prepareTextClose(connectionFor(address));
    },
    setActive(address: TextConnectionAddress, active: boolean) {
      const connection = connectionFor(address);
      connection.active = active;
      for (const member of connection.members.values()) {
        if (active) observeTextMember(deps, connection, member);
        else member.stop?.();
      }
    },
    async disconnect(address: TextConnectionAddress) {
      const connection = connectionFor(address);
      connection.disposed = true;
      failTextClose(connection, {
        code: "session_closed",
        message: "The text placement was disconnected",
        retryable: false,
      });
      for (const member of connection.members.values()) member.stop?.();
      await Promise.allSettled([...connection.pending]);
      await Promise.allSettled([...connection.members.values()].map((member) => releaseMember(connection, member)));
      connection.listeners.clear();
      connection.buffered.clear();
      connections.delete(connection.token);
    },
    async dispose() {
      stopInvalidation();
      await Promise.allSettled(
        [...connections.values()].map(async (connection) => {
          connection.disposed = true;
          failTextClose(connection, {
            code: "session_closed",
            message: "The text service was closed",
            retryable: false,
          });
          for (const member of connection.members.values()) member.stop?.();
          await Promise.allSettled([...connection.pending]);
          await Promise.allSettled([...connection.members.values()].map((member) => releaseMember(connection, member)));
          connection.listeners.clear();
          connection.buffered.clear();
        }),
      );
      connections.clear();
    },
  };
};
