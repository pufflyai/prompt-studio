import { expect, test } from "bun:test";
import { createDesktopUpgrade } from "./desktop-upgrade";

test("a downloaded update requires the person to open and accept its restart confirmation", async () => {
  let restarts = 0;
  const upgrade = createDesktopUpgrade({
    restartToInstallUpdate: async () => {
      restarts += 1;
    },
  })!;
  upgrade.update({ version: "0.49.0" });
  expect(upgrade.getState().open).toBe(false);
  await upgrade.restart();
  expect(restarts).toBe(0);

  upgrade.setOpen(true);
  upgrade.setOpen(false);
  await upgrade.restart();
  expect(restarts).toBe(0);

  upgrade.setOpen(true);
  await upgrade.restart();
  expect(restarts).toBe(1);
});
