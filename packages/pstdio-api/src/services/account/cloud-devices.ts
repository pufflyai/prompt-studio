import type {
  CloudDevice,
  CloudDeviceProvider,
  CloudDeviceProviderInput,
  StartCloudDeviceInput,
} from "pstdio-api-contracts";
import {
  cloudDeviceProviderSchema,
  prepareCloudDeviceBootstrapSchema,
  startCloudDeviceSchema,
} from "pstdio-api-contracts";
import { z } from "zod";
import { CloudDeviceRequestError, createCloudDeviceProvider } from "./cloud-device-provider";
import { createCloudEnrollment } from "./cloud-enrollment";
import type { DeviceLogin } from "./native-store";
import { readPrivateFile, serializeNativeWrite, writePrivateFile } from "./private-file";

const stateSchema = z.strictObject({
  providers: z.record(z.string(), cloudDeviceProviderSchema),
  devices: z.array(
    z.strictObject({ accountId: z.string(), id: z.uuid(), name: z.string(), providerId: z.string().nullable() }),
  ),
});
type Entry = z.infer<typeof stateSchema>["devices"][number];

/** Device infrastructure is native, account-scoped and local to the controlling device; secrets never sync. */
export const createCloudDevices = (input: {
  file: string;
  current: () => Promise<DeviceLogin>;
  issueEnrollment: (input: { deviceId: string; name: string }) => Promise<unknown>;
  devices: () => Promise<{ id: string; online: boolean }[]>;
  /** Internal fixture transport; never configurable through the public API. */
  providerOrigin?: string;
}) => {
  const read = () => readPrivateFile(input.file, stateSchema, { providers: {}, devices: [] });
  const configuration = async (accountId: string) => {
    const config = (await read()).providers[accountId];
    if (!config) throw new CloudDeviceRequestError("Configure your cloud provider before starting a device.");
    return createCloudDeviceProvider(config, input.providerOrigin);
  };
  const saveProviderId = async (entry: Entry, providerId: string) => {
    const state = await read();
    const saved = state.devices.find((item) => item.id === entry.id && item.accountId === entry.accountId);
    if (!saved) throw new CloudDeviceRequestError("Unknown cloud device.");
    saved.providerId = providerId;
    await writePrivateFile(input.file, state);
    return saved;
  };
  const present = async (entry: Entry, provider: Awaited<ReturnType<typeof configuration>>) => {
    const found = await provider.find(entry.id, entry.providerId);
    if (found && !entry.providerId) entry = await saveProviderId(entry, String(found.id));
    const devices = await input.devices().catch(() => null);
    return {
      id: entry.id,
      name: entry.name,
      providerId: entry.providerId,
      power: found?.status ?? "unconfirmed",
      online: devices?.some((device) => device.id === entry.id && device.online) ?? null,
    } satisfies CloudDevice;
  };
  const own = async (id: string) => {
    const login = await input.current();
    const entry = (await read()).devices.find((item) => item.id === id && item.accountId === login.accountId);
    if (!entry) throw new CloudDeviceRequestError("Unknown cloud device for this account.");
    return { entry, provider: await configuration(login.accountId) };
  };
  const cloudDevices = () =>
    serializeNativeWrite(input.file, async () => {
      const login = await input.current();
      const entries = (await read()).devices.filter((entry) => entry.accountId === login.accountId);
      if (!entries.length) return [];
      const provider = await configuration(login.accountId);
      const devices: CloudDevice[] = [];
      for (const entry of entries) devices.push(await present(entry, provider));
      return devices;
    });
  return {
    prepareCloudDeviceBootstrap: (value: { name: string; id?: string }) =>
      serializeNativeWrite(input.file, async () => {
        const intent = prepareCloudDeviceBootstrapSchema.parse(value);
        const login = await input.current();
        if (intent.id) await own(intent.id);
        const deviceId = intent.id ?? crypto.randomUUID();
        const envelope = await input.issueEnrollment({ deviceId, name: intent.name });
        if ((await input.current()).token !== login.token)
          throw new CloudDeviceRequestError("Your login changed. Start again from your current account.");
        const path = `${input.file}.${deviceId}.bootstrap`;
        await writePrivateFile(path, envelope);
        const { expiresAt } = z.object({ expiresAt: z.string() }).parse(envelope);
        return { deviceId, path, expiresAt };
      }),
    async cloudDeviceProvider() {
      const login = await input.current();
      const config = (await read()).providers[login.accountId];
      if (!config) return { configured: false } satisfies CloudDeviceProvider;
      const { token: _token, ...publicConfig } = config;
      return { configured: true, ...publicConfig } satisfies CloudDeviceProvider;
    },
    configureCloudDeviceProvider: (config: CloudDeviceProviderInput) =>
      serializeNativeWrite(input.file, async () => {
        const login = await input.current();
        const state = await read();
        state.providers[login.accountId] = cloudDeviceProviderSchema.parse(config);
        await writePrivateFile(input.file, state);
        return { ok: true };
      }),
    cloudDevices,
    startCloudDevice: (value: StartCloudDeviceInput) =>
      serializeNativeWrite(input.file, async () => {
        const intent = startCloudDeviceSchema.parse(value);
        if ("id" in intent) {
          const { entry, provider } = await own(intent.id);
          const found = await provider.find(entry.id, entry.providerId);
          // Never retry an ambiguous creation by creating another billable resource.
          if (!found)
            throw new CloudDeviceRequestError(
              "Creation is unconfirmed. Inspect the provider operation before starting a replacement.",
            );
          if (!entry.providerId) await saveProviderId(entry, String(found.id));
          if (found.status === "off") await provider.action(String(found.id), "power_on");
          return present({ ...entry, providerId: String(found.id) }, provider);
        }
        const login = await input.current();
        const provider = await configuration(login.accountId);
        const entry: Entry = {
          accountId: login.accountId,
          id: crypto.randomUUID(),
          name: intent.name,
          providerId: null,
        };
        const state = await read();
        state.devices.push(entry);
        // Record the operation identity before any provider request, including lost responses.
        await writePrivateFile(input.file, state);
        const envelope = await input.issueEnrollment({ deviceId: entry.id, name: entry.name });
        if ((await input.current()).token !== login.token)
          throw new CloudDeviceRequestError("Your login changed. Start again from your current account.");
        const found = await provider.create(entry.id, envelope);
        const saved = await saveProviderId(entry, String(found.id));
        return present(saved, provider);
      }),
    stopCloudDevice: (id: string) =>
      serializeNativeWrite(input.file, async () => {
        const { entry, provider } = await own(id);
        const found = await provider.find(entry.id, entry.providerId);
        if (!found)
          throw new CloudDeviceRequestError("The provider resource is not confirmed. Refresh before stopping it.");
        if (found.status === "active") await provider.action(String(found.id), "shutdown");
        return present(entry, provider);
      }),
  };
};

export const createNativeCloudDevices = (
  file: string,
  current: () => Promise<DeviceLogin>,
  call: (path: string, body?: unknown, credential?: string) => Promise<unknown>,
) => ({
  ...createCloudDevices({
    file: `${file}.cloud-devices.json`,
    current,
    issueEnrollment: createCloudEnrollment({ current, call }),
    devices: async () =>
      z.object({ devices: z.array(z.object({ id: z.string(), online: z.boolean() })) }).parse(await call("/v1/devices"))
        .devices,
  }),
  issueCloudEnrollment: createCloudEnrollment({ current, call }),
});
