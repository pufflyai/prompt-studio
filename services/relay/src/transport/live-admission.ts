import type { LiveClientMessage, LiveServerMessage } from "pstdio-sync-contracts";
import type { RelayLimits } from "../limits";
import type { RateLimit } from "./rate-limit";

export const createLiveAdmission = (input: {
  limits: RelayLimits;
  allow: RateLimit;
  deviceId: string;
  send: (message: LiveServerMessage) => void;
  close: (code: number) => void;
}) => {
  let retryAt = 0;
  return (message: LiveClientMessage) => {
    const requestId = "requestId" in message ? message.requestId : undefined;
    if (requestId && Date.now() < retryAt) {
      input.close(1013);
      return false;
    }
    if (input.allow(input.deviceId)) {
      retryAt = 0;
      return true;
    }
    if (!requestId) {
      input.close(1013);
      return false;
    }
    const { requestsPerSecond, requestBurst } = input.limits;
    const retryAfterMs = requestsPerSecond > 0 && requestBurst > 0 ? Math.ceil(1000 / requestsPerSecond) : null;
    retryAt = retryAfterMs === null ? Number.POSITIVE_INFINITY : Date.now() + retryAfterMs;
    input.send({ type: "control-result", requestId, retryAfterMs });
    return false;
  };
};
