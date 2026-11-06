import type { Asset, ReadResult, StateEnvelope, StateInfo, StoredUpdate, UpdateEnvelope } from "pstdio-sync-contracts";

const decode = (payload: string) => Uint8Array.from(Buffer.from(payload, "base64"));

/** An in-memory relay with the blind relay's document and blob rules. */
export const createRelay = () => {
  let latest: (StateEnvelope & StateInfo) | null = null;
  let sequence = 0;
  let updates: StoredUpdate[] = [];
  let damagedState: (StateEnvelope & StateInfo) | null = null;
  let failUpdates = false;
  const blobs = new Map<string, Uint8Array>();
  const manifestChildren = new Map<string, string[]>();
  const requests = { reads: 0, blobs: 0, updates: 0, states: 0 };
  const relay = {
    async manifestBlobs() {
      return {
        async put(blobId: string, bytes: Uint8Array, children: string[]) {
          if (children.length > 256 || new Set(children).size !== children.length)
            throw new Error("Invalid manifest children");
          if (children.some((id) => !blobs.has(id))) throw new Error("Missing manifest child");
          const previous = manifestChildren.get(blobId);
          if (previous && JSON.stringify(previous) !== JSON.stringify(children))
            throw new Error("Manifest children are immutable");
          blobs.set(blobId, bytes.slice());
          manifestChildren.set(blobId, [...children]);
        },
        async get(blobId: string, byteLength: number) {
          requests.blobs++;
          const bytes = blobs.get(blobId);
          if (!bytes) throw new Error("Missing manifest blob");
          if (bytes.length !== byteLength) throw new Error("Manifest blob differs from authenticated extent");
          return bytes.slice();
        },
      };
    },
    read: async (after: number): Promise<ReadResult> => {
      requests.reads++;
      const newer = updates.filter((update) => update.sequence > after);
      if (newer.length !== sequence - after) return { status: "state-required", state: latest, lastSequence: sequence };
      return { status: "updates", state: latest, lastSequence: sequence, updates: newer, more: false };
    },
    state: async () => decode(latest!.payload),
    update: async (update: UpdateEnvelope) => {
      if (failUpdates) throw new Error("Network unavailable");
      // The blind relay rejects an update whose payload is larger than 1 MiB.
      if (decode(update.payload).length > 1_048_576) throw new Error("Update is too large");
      requests.updates++;
      updates.push({ ...update, sequence: ++sequence, deviceId: "device", createdAt: new Date().toISOString() });
      return { sequence, duplicate: false };
    },
    replace: async (state: StateEnvelope) => {
      if (state.baseStateId !== (latest?.stateId ?? null)) return false;
      requests.states++;
      for (const blobId of state.blobIds) if (!blobs.has(blobId)) throw new Error("Missing blob");
      latest = {
        ...state,
        byteLength: decode(state.payload).length,
        deviceId: "device",
        createdAt: new Date().toISOString(),
      };
      return true;
    },
    blobs: {
      put: async (blobId: string, bytes: Uint8Array) => {
        blobs.set(blobId, bytes);
      },
      get: async (blobId: string) => {
        requests.blobs++;
        return blobs.get(blobId)!;
      },
    },
  };
  return {
    relay,
    requests,
    updates: () => updates,
    /** Blob IDs in upload order, so a test can damage the ones a later save uploaded. */
    blobIds: () => [...blobs.keys()],
    manifestChildren: () => new Map(manifestChildren),
    damageBlob: (blobId: string) => {
      blobs.set(
        blobId,
        blobs.get(blobId)!.map((byte) => byte ^ 1),
      );
    },
    latest: () => latest,
    damageState: () => {
      damagedState = latest;
      latest = { ...latest!, payload: Buffer.from("not a latest state").toString("base64") };
    },
    repairState: () => {
      latest = damagedState;
    },
    /** Later updates fail as if the network dropped, so a test can stop a device mid-sync. */
    failUpdates: (failing: boolean) => {
      failUpdates = failing;
    },
    /** The relay loses every stored copy of the stream. */
    lose: () => {
      latest = null;
      sequence = 0;
      updates = [];
    },
    /** Models actual ciphertext loss as well as lost stream metadata. */
    loseBlobs: () => {
      blobs.clear();
      manifestChildren.clear();
    },
    // The relay removes updates a latest state covers once their grace period ends.
    trim: () => {
      updates = updates.filter((update) => update.sequence > (latest?.through ?? 0));
    },
  };
};

export const createAssets = () => {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    store: {
      verifyComplete: async (assets: Asset[]) => {
        for (const asset of assets) if (!files.has(asset.sha256)) throw new Error("Asset missing");
      },
      read: async (asset: Asset) => new Blob([files.get(asset.sha256)! as Uint8Array<ArrayBuffer>]).stream(),
      receive: async (
        asset: Asset,
        source: (offset: number, signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>,
      ) => {
        files.set(
          asset.sha256,
          new Uint8Array(await new Response(await source(0, new AbortController().signal)).arrayBuffer()),
        );
      },
    },
  };
};
