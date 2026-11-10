interface QueryReceipt<T> {
  revision: number;
  data: T | undefined;
  error?: Error;
  authoritative: boolean;
}

/** Publication tokens fence both the command completion and TanStack's later cache commit. */
export const createQueryLedger = <T>() => {
  let revision = 0;
  let dirty = false;
  let receipt: QueryReceipt<T> | undefined;
  const current = () => (receipt?.revision === revision ? receipt : undefined);
  const complete = (issued: number, data: T | undefined, error?: Error) => {
    if (issued !== revision) return false;
    dirty = false;
    receipt = { revision, data, error, authoritative: false };
    return true;
  };
  const resolve = (value: T) => {
    const accepted = current();
    if (!accepted) return value;
    if (accepted.error) throw accepted.error;
    return accepted.data!;
  };
  return {
    resolve,
    recover(error: unknown) {
      if (!current()?.authoritative) throw error;
      return resolve(undefined as T);
    },
    revision: () => revision,
    dirty: () => dirty,
    current,
    invalidate() {
      revision++;
      dirty = true;
    },
    complete,
    fail(issued: number, data: T | undefined, cause: unknown) {
      return complete(issued, data, cause instanceof Error ? cause : new Error(String(cause)));
    },
    accept(data: T | undefined, error?: Error) {
      revision++;
      dirty = false;
      receipt = { revision, data, error, authoritative: true };
      return receipt;
    },
  };
};
