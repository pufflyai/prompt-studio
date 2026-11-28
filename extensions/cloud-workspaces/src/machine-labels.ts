import type { Machine } from "./machines";

const labels: Record<Machine["state"], string> = {
  queued: "Queued",
  provisioning: "Starting machine",
  connected: "Starting agent",
  ready: "Ready",
  preserving: "Saving checkpoint",
  terminating: "Stopping",
  succeeded: "Completed",
  failed: "Failed",
  canceled: "Canceled",
  expired: "Expired",
  preserved: "Preserved",
};
export const machineStates = Object.entries(labels).map(([value, label]) => ({ value, label }));
export const machineStateLabel = (state: Machine["state"]) => labels[state];
