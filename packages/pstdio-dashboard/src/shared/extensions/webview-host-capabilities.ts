import type { HostCapabilityRegistry, WebviewHostCapability } from "pstdio-extensions/bridge/contract";

interface CommandExecuteInput {
  body: unknown;
  commandId: string;
}

interface DashboardWebviewHostCapabilitiesInput {
  dispatchKeyboardEvent: (event: KeyboardEventInit) => void;
  emitActivity: (item: unknown) => void;
  executeCommand: (input: CommandExecuteInput) => Promise<unknown>;
  openResource: (input: unknown) => void;
  projectId?: string;
  reportDiagnostic: (diagnostic: unknown) => void;
  setThemePreference: (preference: string) => void;
  showNotification: (notification: {
    level: "info" | "success" | "warning" | "error";
    message?: string;
    title: string;
  }) => void;
  themePreference: string;
}

const requireRecord = (value: unknown, capability: WebviewHostCapability) => {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  throw new Error(`${capability} requires an object parameter.`);
};

const requireString = (record: Record<string, unknown>, key: string, capability: WebviewHostCapability) => {
  const value = record[key];
  if (typeof value === "string" && value.length > 0) return value;
  throw new Error(`${capability} requires ${key}.`);
};

const optionalRecord = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
};

const createCommandBody = (params: Record<string, unknown>) => ({
  ...(optionalRecord(params, "metadata") ? { metadata: params.metadata } : {}),
  ...(optionalRecord(params, "repo") ? { repo: params.repo } : {}),
  ...(optionalRecord(params, "resource") ? { resource: params.resource } : {}),
  params: optionalRecord(params, "params"),
  source: "dashboard",
});

export const createDashboardWebviewHostCapabilities = (input: DashboardWebviewHostCapabilitiesInput) =>
  ({
    "commands.execute": async (params) => {
      const record = requireRecord(params, "commands.execute");
      return await input.executeCommand({
        body: createCommandBody(record),
        commandId: requireString(record, "commandId", "commands.execute"),
      });
    },
    "resource.open": (params) => {
      input.openResource(params);
    },
    "notification.show": (params) => {
      const record = requireRecord(params, "notification.show");
      input.showNotification({
        level: record.level as "info" | "success" | "warning" | "error",
        message: typeof record.message === "string" ? record.message : undefined,
        title: requireString(record, "title", "notification.show"),
      });
    },
    "preferences.get": (params) => {
      const record = requireRecord(params, "preferences.get");
      const name = requireString(record, "name", "preferences.get");
      if (name === "dashboard.projectId") return input.projectId;
      if (name === "dashboard.themePreference") return input.themePreference;
      throw new Error(`Unsupported dashboard preference: ${name}`);
    },
    "preferences.set": (params) => {
      const record = requireRecord(params, "preferences.set");
      const name = requireString(record, "name", "preferences.set");
      if (name !== "dashboard.themePreference") throw new Error(`Unsupported dashboard preference: ${name}`);
      const value = requireString(record, "value", "preferences.set");
      input.setThemePreference(value);
      return { name, value };
    },
    "activity.emit": (params) => {
      input.emitActivity(params);
    },
    "diagnostics.report": (params) => {
      input.reportDiagnostic(params);
    },
    "host.dispatchKeyboardEvent": (params) => {
      input.dispatchKeyboardEvent(params as KeyboardEventInit);
    },
  }) satisfies HostCapabilityRegistry;
