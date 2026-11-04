import { expect, test } from "bun:test";
import { createDevicesController } from "./devices-controller";

const device = { id: "cloud", name: "Cloud", providerId: "42", power: "active", online: null };
const account = () => ({
  status: async () => ({
    login: {
      accountId: "owner",
      deviceId: "laptop",
      managerOrigin: "https://manager.test",
      relayOrigin: "https://relay.test",
    },
    features: { relay: true },
    cloudProjects: [],
    cloudProjectsLoaded: true,
  }),
  cloudDeviceProvider: async () => ({ configured: false as const }),
  cloudDevices: async () => [device],
  devices: async () => {
    throw new Error("Account device list unavailable");
  },
});

test("device controls retain provider state when account device presence cannot be listed", async () => {
  const controller = createDevicesController(account());
  await controller.refresh();
  expect(controller.get()).toMatchObject({ signedIn: true, devices: [device], accountDevices: null });
  expect(controller.get().error).toBeUndefined();
  expect(controller.get().busy).toBeUndefined();
});

test("a failed action keeps its original error when the subsequent refresh also fails", async () => {
  const api = account();
  const controller = createDevicesController(api);
  await controller.refresh();
  api.cloudDevices = async () => {
    throw new Error("Later read failed");
  };
  await controller.run("Stopping", async () => {
    throw new Error("Provider stop rejected");
  });
  expect(controller.get()).toMatchObject({ devices: [device], error: "Provider stop rejected" });
  expect(controller.get().busy).toBeUndefined();
  expect(controller.get().elapsed).toBeGreaterThanOrEqual(0);
  controller.dismiss();
  expect(controller.get().error).toBeUndefined();
});

test("a second request cannot create another device while the first request is pending", async () => {
  const controller = createDevicesController(account());
  const hold = Promise.withResolvers<void>();
  let creates = 0;
  const first = controller.run("Starting", async () => {
    creates += 1;
    await hold.promise;
  });
  await controller.run("Starting", async () => {
    creates += 1;
  });
  expect(creates).toBe(1);
  expect(controller.get().busy).toBe("Starting");
  hold.resolve();
  await first;
  expect(controller.get().busy).toBeUndefined();
});

test("switching accounts clears previous device rows even when the new account read fails", async () => {
  const api = account();
  const controller = createDevicesController(api);
  await controller.refresh();
  const previousStatus = await api.status();
  api.status = async () => ({ ...previousStatus, login: { ...previousStatus.login, accountId: "another-owner" } });
  api.cloudDevices = async () => {
    throw new Error("New account provider unavailable");
  };
  await controller.refresh();
  expect(controller.get().devices).toEqual([]);
  expect(controller.get().provider).toEqual({ configured: false });
  expect(controller.get().error).toBe("New account provider unavailable");
});

test("a queued refresh never publishes the previous account's delayed provider rows", async () => {
  const api = account();
  const originalStatus = await api.status();
  let owner = "first",
    reads = 0;
  const started = Promise.withResolvers<void>(),
    delayed = Promise.withResolvers<(typeof device)[]>();
  api.status = async () => ({ ...originalStatus, login: { ...originalStatus.login, accountId: owner } });
  api.cloudDevices = async () => {
    reads += 1;
    started.resolve();
    return reads === 1 ? delayed.promise : [{ ...device, id: "latest" }];
  };
  const controller = createDevicesController(api);
  const leaked: string[] = [];
  controller.subscribe(() => {
    if (owner === "latest")
      leaked.push(
        ...controller
          .get()
          .devices.filter((row) => row.id === "cloud")
          .map((row) => row.id),
      );
  });
  const first = controller.refresh();
  await started.promise;
  owner = "latest";
  await controller.refresh();
  delayed.resolve([device]);
  await first;
  expect(controller.get().accountId).toBe("latest");
  expect(reads).toBe(2);
  expect(controller.get().devices.map((row) => row.id)).toEqual(["latest"]);
  expect(leaked).toEqual([]);
});
