import type { ControlParam, WorkspaceCapacity } from "@pstdio/sdk/extensions";

interface DeviceCapacityInput {
  current: boolean;
  name: string;
  online: boolean;
  lastSeenAt?: string;
  capacity?: WorkspaceCapacity;
  lastLimit?: number | null;
}
const knownLimit = (limit: number | null | undefined) => {
  if (limit === undefined) return "Unknown";
  return limit === null ? "Unlimited" : String(limit);
};
const presence = (input: DeviceCapacityInput) => {
  if (input.current) return "This device";
  if (input.online) return "Online";
  return `Offline · Last seen ${input.lastSeenAt || "unknown"}`;
};
export const capacityControls = (input: DeviceCapacityInput): ControlParam[] => {
  const { current, capacity } = input;
  const fields: ControlParam[] = [
    { id: "device", name: "Device", type: "readOnly", value: input.name },
    { id: "presence", name: "Presence", type: "readOnly", value: presence(input) },
    {
      id: "active",
      name: "Active workspaces",
      type: "readOnly",
      value: capacity ? `${capacity.activeCount} / ${knownLimit(capacity.limit)}` : "Capacity unavailable",
    },
  ];
  if (!current) {
    fields.push({
      id: "limit",
      name: "Last known limit",
      type: "readOnly",
      value: knownLimit(capacity ? capacity.limit : input.lastLimit),
      description: "Change this setting on the device that owns it.",
    });
    return fields;
  }
  fields.push(
    { id: "unlimited", name: "Unlimited workspaces", type: "boolean", defaultValue: capacity?.limit === null },
    {
      id: "limit",
      name: "Workspace limit",
      type: "number",
      defaultValue: capacity?.limit ?? 6,
      min: 1,
      step: 1,
      description: "Running and waiting-for-input workspaces occupy slots. Queued work starts when capacity opens.",
    },
  );
  return fields;
};
