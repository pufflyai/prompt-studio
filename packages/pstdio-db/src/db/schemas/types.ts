import { customType } from "drizzle-orm/pg-core";

export type JsonObject = Record<string, unknown>;

export type ResourceRef = {
  type: string;
  id: string;
  projectId?: string;
  label?: string;
  extensionId?: string;
  metadata?: JsonObject;
};

export const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});
