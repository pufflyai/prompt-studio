import type { TextEditingEvent, TextEditingOpened, TextEditingRequest } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "../workbench-core-types";

type Presence = Extract<TextEditingEvent, { type: "presence" }>;
interface Member {
  handle?: string;
  events: Map<string, Presence>;
}

/** Chrome projects the guest's public membership; it never opens another source session. */
export const createPlacementTextPresence = (workbench: Pick<WorkbenchCore, "presence" | "activation">) => {
  const members = new Map<string, Member>();
  const listeners = new Set<() => void>();
  const refresh = () => {
    for (const listener of listeners) listener();
  };
  const registration = workbench.presence.register({
    getParticipants: () =>
      workbench.activation.isActive()
        ? [...members.values()].flatMap((member) =>
            member.handle
              ? (member.events
                  .get(member.handle)
                  ?.participants.map(({ id, deviceId, label }) => ({ id: deviceId ?? id, label })) ?? [])
              : [],
          )
        : [],
    subscribe(listener) {
      listeners.add(listener);
      const stop = workbench.activation.store.subscribe(listener);
      return () => {
        listeners.delete(listener);
        stop();
      };
    },
  });
  const registered = (request: TextEditingRequest) => {
    if (request.operation !== "register") return;
    if (!members.has(request.memberId)) members.set(request.memberId, { events: new Map() });
  };
  const forget = (request: TextEditingRequest, member: Member | undefined) => {
    if (request.operation === "abandon") {
      const current = members.get(request.memberId);
      if (current === member) members.delete(request.memberId);
      else if (current?.handle && current.handle === member?.handle) {
        // The confirmed release owns this old handle, even if a successor has not been admitted yet.
        current.events.delete(current.handle);
        current.handle = undefined;
      }
    }
    if (request.operation === "close")
      for (const [id, current] of members) if (current.handle === request.handle) members.delete(id);
  };
  return {
    receive(event: TextEditingEvent) {
      if (event.type === "prepareClose" || event.type === "snapshot") return;
      const member = members.get(event.memberId);
      if (!member) return;
      const previous = member.events.get(event.handle);
      if (event.type === "presence") {
        if (!previous || event.version > previous.version) member.events.set(event.handle, event);
      } else if (!event.barrierId && previous) {
        member.events.set(event.handle, { ...previous, participants: [] });
      }
      refresh();
    },
    async request<T>(request: TextEditingRequest, action: () => Promise<T>) {
      registered(request);
      let member = "memberId" in request ? members.get(request.memberId) : undefined;
      if (request.operation === "open" && member) {
        // A new receipt owns this observation, while close still owns the admitted handle.
        member = { handle: member.handle, events: new Map(member.events) };
        members.set(request.memberId, member);
      }
      const result = await action();
      if (request.operation === "open" && member && members.get(request.memberId) === member) {
        const { handle } = result as TextEditingOpened;
        const event = member.events.get(handle);
        member.handle = handle;
        member.events.clear();
        if (event) member.events.set(handle, event);
      }
      forget(request, member);
      refresh();
      return result;
    },
    dispose() {
      registration.dispose();
      members.clear();
      listeners.clear();
    },
  };
};
