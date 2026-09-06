import { customType } from "drizzle-orm/pg-core";

export type JsonObject = Record<string, unknown>;

export type { ResourceRef } from "pstdio-api-contracts/extension-kernel";

export const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});
