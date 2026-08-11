import { afterEach, describe, expect, it } from "bun:test";
import { buildAbsoluteApiUrl, buildApiUrl } from "./api";

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

  it("builds relative API paths when no runtime base URL is configured", () => {
    delete (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY];

    expect(buildApiUrl("/v1/health")).toBe("/v1/health");
  });
});

describe("buildAbsoluteApiUrl", () => {
  afterEach(() => {
    delete (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY];
  });

  it("resolves same-origin API paths against the dashboard origin", () => {
    (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY] = { apiBaseUrl: "/" };

    expect(buildAbsoluteApiUrl("/v1/extensions/runtime", "http://dashboard.test/workbench")).toBe(
      "http://dashboard.test/v1/extensions/runtime",
    );
  });

  it("does not throw when a sandboxed frame reports about:blank as its base URL", () => {
    (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY] = { apiBaseUrl: "/" };

    expect(buildAbsoluteApiUrl("/v1/extensions/runtime", "about:blank")).toBe("http://localhost/v1/extensions/runtime");
  });
});
