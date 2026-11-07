import type { OrderedAdmission, OrderedDecision, OrderedOperation } from "pstdio-sync/records";
import type { createOrderedReceiptIndex, OrderedReceipt } from "pstdio-sync/relay";
import type { OrderedJournal } from "./ordered-journal";
import { isOrderedNativeRequest } from "./ordered-native-identity";
import { operationDependencies } from "./ordered-rebase";
import type { OrderedReceiptRoots } from "./ordered-receipts-state";

export const createOrderedReceiptResolver = (
  journal: OrderedJournal,
  root: OrderedReceiptRoots["root"],
  index: ReturnType<typeof createOrderedReceiptIndex>,
) => {
  const cache = async (receipt: OrderedReceipt | undefined) => {
    if (receipt) await journal.recordDecision(receipt.decision, receipt.admissionFingerprint, { indexed: true });
    return receipt;
  };
  const exact = async (id: string, epoch: string) =>
    (await journal.cachedReceipt(id, epoch)) ?? cache(await index.receipt(root, epoch, id));
  const retainedIdentity = async (id: string, fingerprint: string) => {
    const known = await index.identity(root, id);
    if (known && known !== fingerprint) throw new Error("Operation identity reused with changed payload");
    return known ?? fingerprint;
  };
  const identity = async (id: string, fingerprint: string) =>
    journal.bindIdentity(id, await retainedIdentity(id, fingerprint));
  const findDependency = async (id: string, fingerprint: string, epoch: string) => {
    await identity(id, fingerprint);
    const coordinates = await journal.operationCoordinates(id);
    const saved = coordinates?.settled;
    if (saved) {
      const receipt = await exact(id, saved);
      if (!receipt) throw new Error("A settled dependency requires its exact receipt");
      return receipt.decision;
    }
    let receipt = await exact(id, epoch);
    if (!receipt && coordinates?.admission === epoch) return;
    if (!receipt && coordinates?.admission) receipt = await exact(id, coordinates.admission);
    receipt ??= await cache(await index.known(root, id));
    return receipt?.decision;
  };
  const dependency = async (id: string, fingerprint: string, epoch: string) => {
    const decision = await findDependency(id, fingerprint, epoch);
    if (!decision) throw new Error("An ordered dependency requires its exact receipt");
    return decision;
  };
  const reconcile = async (
    local: NonNullable<Awaited<ReturnType<OrderedJournal["localOperation"]>>>,
    epoch: string,
  ) => {
    if (isOrderedNativeRequest(local.requestFingerprint)) return;
    await identity(local.operation.operationId, local.operation.fingerprint);
    let known = await exact(local.operation.operationId, epoch);
    // Once admitted in this order, a later historical receipt cannot settle its new wrapper.
    if (!known && local.admission?.epoch === epoch) return;
    if (!known && local.admission) known = await exact(local.operation.operationId, local.admission.epoch);
    known ??= await cache(await index.known(root, local.operation.operationId));
    if (known) await journal.settleKnown(known.decision);
    return known;
  };
  const hydrateDependencies = async (admission: OrderedAdmission) => {
    for (const dependency of admission.dependencies) {
      await identity(dependency.operationId, dependency.fingerprint);
      if (!(await exact(dependency.operationId, dependency.epoch)))
        throw new Error("An ordered dependency requires its exact receipt");
    }
  };
  return {
    exact,
    identity,
    dependency,
    probeDependency: findDependency,
    hydrateDependencies,
    /**
     * A base only chooses which paths apply, so it can name this device's own earlier save that is
     * already ahead of it in relay order (`ordered`) instead of waiting for that save's receipt.
     */
    async availableDependencies(operation: OrderedOperation, epoch: string, ordered = new Set<string>()) {
      const known = new Map<string, OrderedDecision>();
      const refusing = operationDependencies(operation, { base: false });
      for (const [id, fingerprint] of operationDependencies(operation)) {
        const decision = await findDependency(id, fingerprint, epoch);
        if (decision) known.set(id, decision);
        else if (refusing.has(id) || !ordered.has(id)) return;
      }
      return known;
    },
    async dependencies(operation: OrderedOperation, epoch: string) {
      const known = new Map<string, OrderedDecision>();
      for (const [id, fingerprint] of operationDependencies(operation))
        known.set(id, await dependency(id, fingerprint, epoch));
      return known;
    },
    async admission(admission: OrderedAdmission) {
      // recordDecision binds the SQL identity in this same owner transaction.
      // Verify retained history here without writing the same row twice per save.
      await retainedIdentity(admission.operation.operationId, admission.operation.fingerprint);
      const previous = await exact(admission.operation.operationId, admission.epoch);
      await hydrateDependencies(admission);
      return previous?.decision;
    },
    reconcile,
    async reconcilePending(epoch: string) {
      const changed = new Set<string>();
      let after = 0;
      while (true) {
        const page = await journal.pending({ after });
        if (!page.length) return [...changed];
        for (const local of page)
          if (await reconcile(local, epoch)) {
            for (const edit of local.operation.edits) changed.add(edit.recordId);
          }
        after = page.at(-1)!.sequence;
      }
    },
  };
};
