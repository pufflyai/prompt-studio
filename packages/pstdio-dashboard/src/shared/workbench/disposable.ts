import type { Disposable } from "@pstdio/workbench";

export type MaybeDisposable = Disposable | readonly Disposable[] | undefined;

export const toDisposables = (value: MaybeDisposable) => {
  if (!value) return [] as Disposable[];
  const values = Array.isArray(value) ? value : [value];
  return values.filter((entry): entry is Disposable => typeof entry?.dispose === "function");
};
