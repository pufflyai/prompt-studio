import { readFileSync } from "node:fs";

export interface PerformanceEndpointDescriptor {
  port: number;
  token: string;
}

export const readPerformanceEndpointDescriptor = (path: string) => {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    if (!Number.isInteger(value.port) || value.port < 1 || value.port > 65535) return null;
    if (typeof value.token !== "string" || !/^[a-f0-9]{64}$/.test(value.token)) return null;
    return value as PerformanceEndpointDescriptor;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};
