import { expect, test } from "bun:test";
import { createDesktopUpgrade } from "./desktop-upgrade";

test("canceling a restart prevents download completion from accepting a reopened prompt", async () => {
  let restarts = 0;
  const upgrade = createDesktopUpgrade({
    restartToInstallUpdate: async () => {
      restarts += 1;
    },
  })!;
  upgrade.update({ version: "0.49.0", ready: false, prompt: true });
  await upgrade.restart("confirm");
  expect(restarts).toBe(0);

  upgrade.setOpen(false);
  upgrade.setOpen(true);
  upgrade.update({ version: "0.49.0", ready: true, prompt: false });
  await upgrade.restart("waiting");
  expect(restarts).toBe(0);

  await upgrade.restart("confirm");
  expect(restarts).toBe(1);
});
