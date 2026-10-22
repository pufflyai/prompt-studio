const MiB = 1024 ** 2;
const GiB = 1024 ** 3;

/** Operator limits for the sync protocol (PRD 0014 R20, R21 and R28). */
export interface RelayLimits {
  /** How long replaced latest states, covered updates and unused blobs stay after they stop being needed. */
  gracePeriodMs: number;
  maxUpdateBytes: number;
  maxStateBytes: number;
  maxSummaryBytes: number;
  maxBlobBytes: number;
  maxLiveMessageBytes: number;
  /** Encrypted bytes one account may store across updates, latest states and blobs. */
  accountQuotaBytes: number;
  /** Update bytes returned by one read. Clients read again while `more` is true. */
  maxReadBytes: number;
  /** Requests and live messages per device. */
  requestsPerSecond: number;
  requestBurst: number;
}

export const defaultRelayLimits: RelayLimits = {
  gracePeriodMs: 7 * 24 * 60 * 60 * 1000,
  maxUpdateBytes: 1 * MiB,
  maxStateBytes: 64 * MiB,
  maxSummaryBytes: 64 * 1024,
  maxBlobBytes: 5 * GiB,
  maxLiveMessageBytes: 64 * 1024,
  accountQuotaBytes: 50 * GiB,
  maxReadBytes: 8 * MiB,
  requestsPerSecond: 50,
  requestBurst: 500,
};

const variables: Record<keyof RelayLimits, string> = {
  gracePeriodMs: "RELAY_GRACE_PERIOD_SECONDS",
  maxUpdateBytes: "RELAY_MAX_UPDATE_BYTES",
  maxStateBytes: "RELAY_MAX_STATE_BYTES",
  maxSummaryBytes: "RELAY_MAX_SUMMARY_BYTES",
  maxBlobBytes: "RELAY_MAX_BLOB_BYTES",
  maxLiveMessageBytes: "RELAY_MAX_LIVE_MESSAGE_BYTES",
  accountQuotaBytes: "RELAY_ACCOUNT_QUOTA_BYTES",
  maxReadBytes: "RELAY_MAX_READ_BYTES",
  requestsPerSecond: "RELAY_REQUESTS_PER_SECOND",
  requestBurst: "RELAY_REQUEST_BURST",
};

export const readRelayLimits = (env: Record<string, string | undefined>) => {
  const limits = { ...defaultRelayLimits };
  for (const [name, variable] of Object.entries(variables) as [keyof RelayLimits, string][]) {
    const value = env[variable];
    if (value === undefined) continue;
    const number = Number(value);
    if (value === "" || !Number.isSafeInteger(number) || number < 0) throw new Error(`${variable} must be an integer`);
    limits[name] = name === "gracePeriodMs" ? number * 1000 : number;
  }
  return limits;
};
