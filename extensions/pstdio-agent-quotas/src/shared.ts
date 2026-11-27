// Shared by the backend and the webviews: keep this module free of server and DOM code.
import { eventRef } from "@pstdio/sdk/extensions";

export const EXTENSION_ID = "pstdio.agent-quotas";

/** Emitted after a quota read or a provider selection is saved. Views refetch; the payload is only a signal. */
export const quotasChanged = eventRef<{ provider: string }>({ extensionId: EXTENSION_ID, id: "quotas.changed" });

/** One quota window as the harness `quotas` commands report it. */
export interface QuotaLimit {
  id: string;
  label: string;
  remainingPercent: number;
  resetsAt?: string;
  windowMinutes?: number;
  /** Set by harnesses for windows that apply to one model family, such as Claude's Opus weekly limit. */
  modelFamily?: string;
}

export interface ProviderQuotas {
  id: string;
  label: string;
  /** Short name for the status bar. */
  short: string;
  status: "available" | "unavailable" | "unsupported";
  checkedAt: string;
  message?: string;
  limits: QuotaLimit[];
}

export interface ProviderOption {
  id: string;
  label: string;
}

export interface QuotaStatus {
  /** Harnesses with a quota command that are turned on in this project. */
  options: ProviderOption[];
  /** Quotas of the provider the footer follows, or undefined when no harness is on. */
  selected?: ProviderQuotas;
}
