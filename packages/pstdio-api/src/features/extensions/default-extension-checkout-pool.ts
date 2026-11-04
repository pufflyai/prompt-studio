import { sourceFor } from "./default-extension-entries";
import type { DefaultExtensionEntry } from "./default-extensions-config";
import { createSharedNamedSourceCheckout, isLocalExtensionSource } from "./install-extension-source";

type Checkout = Awaited<ReturnType<typeof createSharedNamedSourceCheckout>>;

// Reserve every selected participant before asynchronous target work starts. A retry also
// leases the source, so the final original participant cannot delete an active retry's files.
export const createDefaultBatchCheckoutPool = (
  entries: DefaultExtensionEntry[],
  prepareShared = createSharedNamedSourceCheckout,
) => {
  const members = entries.map((entry) =>
    isLocalExtensionSource(sourceFor(entry)) ? undefined : { ref: typeof entry === "string" ? undefined : entry.ref },
  );
  const remaining = new Map<string | undefined, number>();
  for (const member of members) if (member) remaining.set(member.ref, (remaining.get(member.ref) ?? 0) + 1);
  const finished = new Set<number>();
  const pending = new Map<string | undefined, { checkout: Promise<Checkout>; users: number }>();
  const cleanup = (ref: string | undefined, lease: { users: number }, shared: Checkout) => {
    if (lease.users || remaining.get(ref)) return;
    shared.cleanup();
    pending.delete(ref);
  };
  const prepare: typeof createSharedNamedSourceCheckout = async (names, options) => {
    const ref = options?.ref;
    let lease = pending.get(ref);
    if (!lease) {
      const selected = entries.filter((_entry, index) => members[index] && members[index]!.ref === ref).map(sourceFor);
      lease = {
        checkout: Promise.resolve().then(() => prepareShared(selected.length ? selected : names, options)),
        users: 0,
      };
      pending.set(ref, lease);
    }
    const current = lease;
    current.users++;
    try {
      const shared = await current.checkout;
      return {
        ...shared,
        cleanup: () => {
          current.users--;
          cleanup(ref, current, shared);
        },
      };
    } catch (error) {
      current.users--;
      if (pending.get(ref) === current) pending.delete(ref);
      throw error;
    }
  };
  const complete = async (index: number) => {
    const member = members[index];
    if (!member) return;
    if (!finished.has(index)) {
      finished.add(index);
      remaining.set(member.ref, remaining.get(member.ref)! - 1);
    }
    const lease = pending.get(member.ref);
    if (!lease || lease.users || remaining.get(member.ref)) return;
    const shared = await lease.checkout.catch(() => undefined);
    if (shared) cleanup(member.ref, lease, shared);
    else pending.delete(member.ref);
  };
  return { prepare, complete, abandon: (index: number) => (finished.has(index) ? Promise.resolve() : complete(index)) };
};
