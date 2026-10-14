// The read owner keeps the canonical value and a journal of local edits. Reads
// begun before an edit or while saving cannot replace its preview.
export const createRendererMutations = <T>() => {
  let baseline: T | undefined;
  let revision = 0;
  const journal: Array<{ update: (value: T) => T; saving: boolean }> = [];
  const pending = () => journal.some((operation) => operation.saving);
  const value = () =>
    baseline === undefined ? undefined : journal.reduce<T>((value, operation) => operation.update(value), baseline!);
  return {
    value,
    pending,
    revision: () => revision,
    accept(next: T, readRevision: number) {
      if (readRevision !== revision || pending()) return false;
      baseline = next;
      journal.length = 0;
      return true;
    },
    begin(update: (value: T) => T) {
      revision += 1;
      const operation = { update, saving: true };
      journal.push(operation);
      return operation;
    },
    finish(operation: (typeof journal)[number], success: boolean) {
      revision += 1;
      operation.saving = false;
      if (!success) journal.splice(journal.indexOf(operation), 1);
    },
  };
};

/** Connection changes rebind transport reads, not local mutation ownership. */
export const createRendererMutationBinding = <T>() => {
  let key: string | undefined;
  let owner = createRendererMutations<T>();
  return {
    bind(ownerKey: string, queryKey: string) {
      const next = JSON.stringify([ownerKey, queryKey]);
      if (key !== undefined && key !== next) owner = createRendererMutations<T>();
      key = next;
      return owner;
    },
  };
};
