import { type CollectionViewsInput, useCollectionViews } from "@pstdio/ui/collection-view";

/** Select the saved view before any resource query, including the first read. */
export const useRendererViews = <TSettings>(input: CollectionViewsInput<TSettings>, provider?: unknown) =>
  useCollectionViews({ ...input, enabled: !provider || Boolean(input.viewsSource) });
