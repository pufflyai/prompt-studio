import { describe, expect, test } from "bun:test";
import { injectConfig } from "./serve-dashboard";

describe("injectConfig", () => {
  test("embeds runtime config as non-executable metadata before the head closes", () => {
    const html = "<html><head><title>Dashboard</title></head><body></body></html>";
    const config = { apiBaseUrl: "http://localhost:3000", version: "dev" };
    const result = injectConfig(html, config);
    const metaMatch = result.match(/<meta name="pstdio-config" content="([^"]+)"><\/head>/);

    expect(metaMatch?.[1]).toBeString();
    expect(JSON.parse(decodeURIComponent(metaMatch?.[1] ?? ""))).toEqual(config);
    expect(result).not.toContain("<script>");
  });

  test("returns html unchanged when no </head>", () => {
    const html = "<html><body></body></html>";
    const result = injectConfig(html, { apiBaseUrl: "http://localhost:3000" });
    expect(result).toBe(html);
  });
});
