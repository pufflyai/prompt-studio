import type { Instance } from "./instances";

export type OwnerKey = { token: string; expiresAt: string };

const keyLifetimeMs = 24 * 60 * 60 * 1000;

// Keys still expire after a day, but a running controller gets a new one on demand.
// Otherwise an expired key blocks stop, and stop must succeed before remove.
export function createOwnerKeys(deps: {
  read: (id: string) => Promise<OwnerKey>;
  write: (id: string, key: OwnerKey) => Promise<void>;
  create: (instance: Instance, expiresAt: string) => Promise<{ token: string; key: { expires_at: string } }>;
  get: (id: string) => Promise<Instance>;
}) {
  const issue = async (instance: Instance) => {
    const issued = await deps.create(instance, new Date(Date.now() + keyLifetimeMs).toISOString());
    await deps.write(instance.id, { token: issued.token, expiresAt: issued.key.expires_at });
    return issued.token;
  };
  // Table rows load in parallel; one renewal serves them all.
  const renewals = new Map<string, Promise<string>>();
  const renew = (id: string) => {
    let renewal = renewals.get(id);
    if (!renewal) {
      renewal = (async () => {
        const instance = await deps.get(id);
        if (instance.state !== "running") throw new Error("Instance is stopped. Start it to issue a new key.");
        return issue(instance);
      })().finally(() => renewals.delete(id));
      renewals.set(id, renewal);
    }
    return renewal;
  };
  const token = async (id: string) => {
    const owner = await deps.read(id);
    return Date.parse(owner.expiresAt) > Date.now() ? owner.token : renew(id);
  };
  return { issue, token };
}
