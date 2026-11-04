/** A target issues one-use challenges. A captured command cannot run twice or survive target restart. */
export const createDeviceCommandAuthorization = () => {
  const pending = new Map<string, { caller: string; expiresAt: number; chunks: Uint8Array[]; byteLength: number }>();
  let retainedBytes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const release = (id: string) => {
    retainedBytes -= pending.get(id)?.byteLength ?? 0;
    pending.delete(id);
    if (!pending.size) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
  const expire = () => {
    const now = Date.now();
    for (const [id, grant] of pending) if (grant.expiresAt <= now) release(id);
  };
  const schedule = () => {
    if (timer || !pending.size) return;
    const expiresAt = Math.min(...[...pending.values()].map((grant) => grant.expiresAt));
    timer = setTimeout(
      () => {
        timer = undefined;
        expire();
        schedule();
      },
      Math.max(0, expiresAt - Date.now()),
    );
    timer.unref?.();
  };
  return {
    issue(caller: string) {
      const now = Date.now();
      expire();
      if (pending.size >= 1024) throw new Error("Too many pending device authorizations");
      const challenge = crypto.randomUUID();
      // This is authorization freshness, not a deadline for the action after admission.
      pending.set(challenge, { caller, expiresAt: now + 60_000, chunks: [], byteLength: 0 });
      schedule();
      return { challenge };
    },
    append(caller: string, challenge: string, offset: number, bytes: Uint8Array, final: boolean) {
      const grant = pending.get(challenge);
      if (!grant || grant.caller !== caller || grant.expiresAt <= Date.now())
        throw new Error("Device authorization expired or already used");
      if (offset !== grant.byteLength) throw new Error("Device command chunk is out of order");
      if (!bytes.byteLength) throw new Error("Device command chunks must not be empty");
      // A whole supported 25 MiB attachment fits after base64 encoding. Bound all incomplete calls together.
      if (retainedBytes + bytes.byteLength > 64 * 1024 * 1024) {
        release(challenge);
        throw new Error("Device command input exceeds available transfer memory");
      }
      grant.chunks.push(bytes);
      grant.byteLength += bytes.byteLength;
      retainedBytes += bytes.byteLength;
      grant.expiresAt = Date.now() + 60_000;
      if (!final) return { complete: false as const, received: grant.byteLength };
      release(challenge);
      const result = new Uint8Array(grant.byteLength);
      let position = 0;
      for (const chunk of grant.chunks) {
        result.set(chunk, position);
        position += chunk.byteLength;
      }
      return { complete: true as const, bytes: result };
    },
    clear() {
      pending.clear();
      retainedBytes = 0;
      clearTimeout(timer);
      timer = undefined;
    },
  };
};
