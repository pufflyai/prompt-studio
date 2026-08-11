import { afterEach, describe, expect, it } from "bun:test";
import { buildAbsoluteApiUrl, buildApiUrl, readRuntimeConfig } from "./api";

const RUNTIME_CONFIG_KEY = "__PSTDIO_CONFIG__";

type RuntimeConfigWindow = {
  [RUNTIME_CONFIG_KEY]?: {
    apiBaseUrl?: string;
  };
};

type ImportMetaWithEnv = ImportMeta & {
  env?: Record<string, string | undefined>;
};

const withApiBaseUrl = (value: string | undefined, test: () => void) => {
  const env = (import.meta as ImportMetaWithEnv).env ?? {};
  const previous = env.VITE_API_BASE_URL;

  env.VITE_API_BASE_URL = value;

  try {
    test();
  } finally {
    env.VITE_API_BASE_URL = previous;
  }
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

  it("builds relative API paths when no runtime or env base URL is configured", () => {
    delete (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY];

    withApiBaseUrl(undefined, () => {
      expect(buildApiUrl("/v1/health")).toBe("/v1/health");
    });
  });

  it("keeps served runtime requests same-origin when a build-time API URL exists", () => {
    (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY] = {};

    withApiBaseUrl("http://localhost:19841", () => {
      expect(buildApiUrl("/v1/sync/stream")).toBe("/v1/sync/stream");
    });
  });
});

describe("readRuntimeConfig", () => {
  afterEach(() => {
    delete (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY];
    delete (globalThis as { document?: Document }).document;
  });

  it("reads CSP-compatible runtime metadata from the document", () => {
    const config = { apiBaseUrl: "http://localhost:3000", version: "0.25.2" };
    (globalThis as { document?: Pick<Document, "querySelector"> }).document = {
      querySelector: () => ({ content: encodeURIComponent(JSON.stringify(config)) }) as HTMLMetaElement,
    };

    expect(readRuntimeConfig()).toEqual(config);
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
