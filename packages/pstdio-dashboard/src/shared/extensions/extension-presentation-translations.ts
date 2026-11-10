import type { ListExtensionAppearanceResponse } from "@pstdio/sdk/api";
import type { ScopedQuery } from "@pstdio/sdk/extensions";

type Translations = ListExtensionAppearanceResponse["translations"][number];
// A project's last projected bundles must survive leaving it. Weak keys give this
// checkpoint exactly the lifetime of its bounded, account-scoped catalog query.
const accepted = new WeakMap<ScopedQuery<ListExtensionAppearanceResponse>, Map<string, Translations>>();

export const acceptExtensionPresentationTranslations = (
  query: ScopedQuery<ListExtensionAppearanceResponse>,
  appearance: ListExtensionAppearanceResponse,
) => {
  const previous = accepted.get(query);
  const next = new Map(appearance.translations.map((record) => [record.extensionId, record]));
  accepted.set(query, next);
  return [...new Set([...(previous?.keys() ?? []), ...next.keys()])].filter((id) => {
    const before = previous?.get(id);
    const after = next.get(id);
    return before !== after && JSON.stringify(before) !== JSON.stringify(after);
  });
};
