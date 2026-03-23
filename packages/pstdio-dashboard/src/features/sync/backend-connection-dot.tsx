export type BackendConnectionStatus = "connecting" | "connected" | "error";

type BackendConnectionEvent = "connected" | "disconnected";

export const getNextBackendConnectionStatus = (
  currentStatus: BackendConnectionStatus,
  event: BackendConnectionEvent,
) => {
  if (event === "connected") {
    return "connected";
  }

  if (currentStatus === "connected" || currentStatus === "connecting") {
    return "error";
  }

  return currentStatus;
};
