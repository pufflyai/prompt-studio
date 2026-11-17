import type { QuotaReport } from "./quotas";

interface QuotaPolling {
  read(): Promise<QuotaReport[]>;
  onData(reports: QuotaReport[]): void;
  onError(): void;
  intervalMs?: number;
}

export const pollQuotas = ({ read, onData, onError, intervalMs = 60_000 }: QuotaPolling) => {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = async () => {
    try {
      const reports = await read();
      if (!stopped) onData(reports);
    } catch {
      if (!stopped) onError();
    } finally {
      if (!stopped) timer = setTimeout(check, intervalMs);
    }
  };
  void check();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
};
