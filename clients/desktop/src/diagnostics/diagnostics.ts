import { redactSensitiveText } from "pstdio-logging";

type DesktopDiagnostics = {
  appVersion: string;
  platform: string;
  arch: string;
  state: string;
  runtimeOrigin?: string;
  runtimePid?: number;
  ownerType?: string;
  logPath: string;
  detail?: string;
};

export const formatDesktopDiagnostics = (input: DesktopDiagnostics, secrets: string[] = []) => {
  const entries = Object.entries(input).filter((entry): entry is [string, string | number] => entry[1] !== undefined);
  return redactSensitiveText(entries.map(([key, value]) => `${key}: ${String(value)}`).join("\n"), secrets);
};
