import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waitForRuntimeDescriptor } from "./desktop-runtime-startup";

const homes: string[] = [];
const createHome = () => {
  const home = mkdtempSync(join(tmpdir(), "desktop-startup-"));
  homes.push(home);
  return home;
};

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

test("waits through cold setup while the desktop container is running", async () => {
  const home = createHome();
  let elapsed = 0;
  const token = await waitForRuntimeDescriptor(
    home,
    { isContainerRunning: () => true, readContainerLogs: () => "" },
    async (milliseconds) => {
      elapsed += milliseconds;
      if (elapsed === 91_000) writeFileSync(join(home, "runtime.json"), JSON.stringify({ token: "ready-token" }));
    },
  );
  expect(token).toBe("ready-token");
  expect(elapsed).toBe(91_000);
});

test("reports the stopped container's startup error without waiting for a timeout", async () => {
  let waited = false;
  await expect(
    waitForRuntimeDescriptor(
      createHome(),
      { isContainerRunning: () => false, readContainerLogs: () => "Dashboard dependency build failed" },
      async () => {
        waited = true;
      },
    ),
  ).rejects.toThrow("Dashboard dependency build failed");
  expect(waited).toBe(false);
});

test("does not accept a stale descriptor after the container stops", async () => {
  const home = createHome();
  writeFileSync(join(home, "runtime.json"), JSON.stringify({ token: "old-token" }));
  await expect(
    waitForRuntimeDescriptor(home, {
      isContainerRunning: () => false,
      readContainerLogs: () => "Container exited",
    }),
  ).rejects.toThrow("Container exited");
});
