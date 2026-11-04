import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCloudDevices } from "./cloud-devices";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).reverse()) await close();
});
const image = `ghcr.io/pufflyai/prompt-studio/device@sha256:${"a".repeat(64)}`;
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "cloud-device-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const droplets: { id: number; status: string; tags: string[] }[] = [];
  const calls: {
    path: string;
    method: string;
    body: { tags?: string[]; user_data?: string; type?: string } | undefined;
  }[] = [];
  let ambiguous = false;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      expect(request.headers.get("authorization")).toBe("Bearer provider-secret");
      const url = new URL(request.url);
      const body = request.method === "POST" ? await request.json() : undefined;
      calls.push({ path: url.pathname, method: request.method, body });
      if (url.pathname === "/v2/droplets" && body) {
        const droplet = { id: 42, status: "new", tags: body.tags };
        droplets.push(droplet);
        if (ambiguous) return new Response(null, { status: 503 });
        return Response.json({ droplet }, { status: 202 });
      }
      if (url.pathname === "/v2/droplets") return Response.json({ droplets, links: {} });
      if (url.pathname.endsWith("/actions")) return Response.json({ action: { id: 7, status: "in-progress" } });
      return Response.json({ droplet: droplets.find((item) => url.pathname.endsWith(`/${item.id}`)) });
    },
  });
  cleanups.push(() => server.stop(true));
  let accountId = "owner";
  let online = false;
  let unavailable = false;
  const file = join(root, "cloud.json");
  const create = () =>
    createCloudDevices({
      file,
      providerOrigin: server.url.origin,
      current: async () => ({
        accountId,
        deviceId: "laptop",
        token: "laptop-secret",
        managerOrigin: "https://manager.test",
        relayOrigin: "https://relay.test",
      }),
      issueEnrollment: async ({ deviceId }: { deviceId: string; name: string }) => ({
        accountId,
        deviceId,
        grant: "single-use-grant",
        managerOrigin: "https://manager.test",
        relayOrigin: "https://relay.test",
        expiresAt: new Date(Date.now() + 900000).toISOString(),
      }),
      devices: async () => {
        if (unavailable) throw new Error("private manager details");
        return online
          ? droplets.map((droplet) => ({ id: droplet.tags[0].replace("pstdio-device-", ""), online: true }))
          : [];
      },
    });
  const service = create();
  await service.configureCloudDeviceProvider({ token: "provider-secret", region: "ams3", size: "s-2vcpu-4gb", image });
  return {
    service,
    create,
    file,
    calls,
    droplets,
    loseResponse: () => {
      ambiguous = true;
    },
    managerUnavailable: () => {
      unavailable = true;
    },
    account: (id: string) => {
      accountId = id;
    },
    online: () => {
      online = true;
    },
  };
};

test("provisions a distinct private device, then preserves it through stop/start and native restart", async () => {
  const f = await fixture();
  const device = await f.service.startCloudDevice({ name: "My cloud device" });
  expect(device.id).not.toBe("laptop");
  expect(device.power).toBe("new");
  expect(device.online).toBe(false);
  const create = f.calls.find((call) => call.method === "POST")!;
  expect(create.body!.tags).toContain(`pstdio-device-${device.id}`);
  expect(create.body!.user_data).toContain(image);
  expect(create.body!.user_data).toContain("PSTDIO_CLOUD_BOOTSTRAP_FILE");
  expect(create.body!.user_data).not.toContain("laptop-secret");
  expect(create.body!.user_data).not.toContain("provider-secret");
  expect(create.body!.user_data).not.toContain("--publish");
  expect(await f.service.cloudDeviceProvider()).toEqual({
    configured: true,
    region: "ams3",
    size: "s-2vcpu-4gb",
    image,
  });
  expect((await stat(f.file)).mode & 0o777).toBe(0o600);
  f.droplets[0].status = "active";
  f.online();
  expect((await f.service.cloudDevices())[0]).toMatchObject({ id: device.id, power: "active", online: true });
  // An accepted shutdown is not proof that shutdown completed.
  expect((await f.service.stopCloudDevice(device.id)).power).toBe("active");
  expect(f.calls.at(-2)?.body?.type ?? f.calls.at(-1)?.body?.type).toBe("shutdown");
  f.droplets[0].status = "off";
  const restarted = f.create();
  await restarted.startCloudDevice({ id: device.id });
  expect(f.calls.filter((call) => call.body?.type === "power_on")).toHaveLength(1);
  expect(f.droplets).toHaveLength(1);
  expect((await restarted.cloudDevices())[0].id).toBe(device.id);
});

test("reconciles an ambiguous create response before another start and never duplicates the provider resource", async () => {
  const f = await fixture();
  f.loseResponse();
  await expect(f.service.startCloudDevice({ name: "Remote" })).rejects.toThrow();
  const [pending] = await f.create().cloudDevices();
  expect(pending.providerId).toBe("42");
  await f.create().startCloudDevice({ id: pending.id });
  expect(f.calls.filter((call) => call.path === "/v2/droplets" && call.method === "POST")).toHaveLength(1);
  expect(await readFile(f.file, "utf8")).not.toContain("single-use-grant");
});

test("refuses another account's provider control and a resource whose ownership tag changed", async () => {
  const f = await fixture();
  const device = await f.service.startCloudDevice({ name: "Remote" });
  f.account("another-owner");
  expect(await f.service.cloudDevices()).toEqual([]);
  await expect(f.service.stopCloudDevice(device.id)).rejects.toThrow();
  f.account("owner");
  f.droplets[0].tags = [];
  await expect(f.service.stopCloudDevice(device.id)).rejects.toThrow();
  expect(f.calls.some((call) => call.path.endsWith("/actions"))).toBe(false);
});

test("provider controls remain available when account presence cannot be read", async () => {
  const f = await fixture();
  const device = await f.service.startCloudDevice({ name: "Remote" });
  f.droplets[0].status = "active";
  f.managerUnavailable();
  const stopped = await f.service.stopCloudDevice(device.id);
  expect(stopped).toMatchObject({ id: device.id, power: "active", online: null });
  expect((await f.service.cloudDevices())[0].online).toBeNull();
});

test("exports a fresh private bootstrap file without a provider request or credential in the response", async () => {
  const f = await fixture();
  const exported = await f.service.prepareCloudDeviceBootstrap({ name: "External device" });
  expect(exported.deviceId).not.toBe("laptop");
  expect(exported.path).toStartWith(f.file);
  expect(Object.keys(exported).sort()).toEqual(["deviceId", "expiresAt", "path"]);
  expect((await stat(exported.path)).mode & 0o777).toBe(0o600);
  const envelope = JSON.parse(await readFile(exported.path, "utf8"));
  expect(envelope).toMatchObject({ deviceId: exported.deviceId, accountId: "owner", grant: "single-use-grant" });
  expect(JSON.stringify(exported)).not.toContain("single-use-grant");
  expect(f.calls).toHaveLength(0);
  await expect(f.service.prepareCloudDeviceBootstrap({ id: crypto.randomUUID(), name: "Another" })).rejects.toThrow();
});
