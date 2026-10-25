import type { ViewRef } from "./types/contribution-identity";

export const pagePlaceholderView = (empty: ViewRef | { readonly view: ViewRef } | undefined) =>
  empty && ("view" in empty ? empty.view : empty);
