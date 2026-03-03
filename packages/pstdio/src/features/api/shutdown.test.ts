import { describe, expect, it } from "bun:test";
import { shutdownApi } from "./shutdown";

describe("shutdownApi", () => {
  it("returns true when API responds ok", async () => {
    const fetcher = async () => ({ ok: true });
    expect(await shutdownApi("http://localhost:3000", fetcher)).toBe(true);
  });

  it("returns false when API responds not ok", async () => {
    const fetcher = async () => ({ ok: false });
    expect(await shutdownApi("http://localhost:3000", fetcher)).toBe(false);
  });

  it("returns false when fetch throws (API not running)", async () => {
    const fetcher = async () => {
      throw new Error("ECONNREFUSED");
    };
    expect(await shutdownApi("http://localhost:3000", fetcher)).toBe(false);
  });
});
