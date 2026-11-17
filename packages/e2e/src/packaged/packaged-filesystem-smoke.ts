import { expect } from "bun:test";
import { homedir } from "node:os";
import { parse } from "node:path";

export const expectPackagedDriveDiscovery = async (baseUrl: string, headers: Record<string, string>) => {
  const response = await fetch(`${baseUrl}/v1/filesystem/drives`, { headers });
  expect(response.status).toBe(200);
  const { drives } = (await response.json()) as { drives: { name: string; path: string }[] };
  if (process.platform !== "win32") {
    expect(drives).toEqual([]);
    return;
  }
  const root = parse(homedir()).root;
  expect(drives).toContainEqual({ name: root.slice(0, 2), path: root });
  const listing = await fetch(`${baseUrl}/v1/filesystem/list?path=${encodeURIComponent(root)}`, { headers });
  expect(listing.status).toBe(200);
  expect((await listing.json()).entries).toBeArray();
};
