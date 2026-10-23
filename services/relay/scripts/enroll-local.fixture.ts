import { createAccountManager } from "pstdio-account-manager";

const input = (await new Response(Bun.stdin.stream()).json()) as {
  deviceId: string;
  name: string;
  workbenchId: string;
};
const accountId = "built-network-account";
const manager = createAccountManager(process.env.DATABASE_URL!);
try {
  // The launcher enrolls a missing or denied login. Enrolling again replaces the device token.
  await manager.addWorkbench({ accountId, workbenchId: input.workbenchId });
  const device = await manager.registerDevice({
    accountId,
    deviceId: input.deviceId,
    name: input.name,
    platform: "linux",
  });
  process.stdout.write(JSON.stringify(device));
} finally {
  await manager.close();
}
