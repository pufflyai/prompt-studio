import { afterEach, describe, expect, it } from "bun:test";
import { buildApiUrl } from "./api";

const RUNTIME_CONFIG_KEY = "__PSTDIO_CONFIG__";

type RuntimeConfigWindow = {
  [RUNTIME_CONFIG_KEY]?: {
    apiBaseUrl?: string;
  };
};

describe("buildApiUrl", () => {
  afterEach(() => {
    delete (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY];
  });

  it("builds same-origin API paths when the runtime config uses / as the base URL", () => {
    (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY] = { apiBaseUrl: "/" };

    expect(buildApiUrl("/v1/projects")).toBe("/v1/projects");
    expect(buildApiUrl("v1/projects")).toBe("/v1/projects");
  });
});
