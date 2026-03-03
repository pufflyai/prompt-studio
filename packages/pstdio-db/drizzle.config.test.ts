import { describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import { createDrizzleConfig } from "./drizzle.config";

describe("createDrizzleConfig", () => {
  it("uses pglite with the local default database path", () => {
    const config = createDrizzleConfig() as {
      dbCredentials: { url: string };
      dialect: string;
      driver: string;
    };

    expect(config.dialect).toBe("postgresql");
    expect(config.driver).toBe("pglite");
    expect(config.dbCredentials.url).toBe(path.join(os.homedir(), ".pstdio", "pstdio.db"));
  });

  it("uses an explicit database path", () => {
    const config = createDrizzleConfig("~/.pstdio/custom") as {
      dbCredentials: { url: string };
    };

    expect(config.dbCredentials.url).toBe(path.join(os.homedir(), ".pstdio", "custom"));
  });
});
