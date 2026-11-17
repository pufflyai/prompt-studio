import type { ListExtensionAppearanceResponse, LocalizableString, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { JsonValue } from "@pstdio/sdk/extensions";
import i18n from "@/i18n";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { createRuntimeState } from "@/lib/sync/runtime-state";

type LocalizedStringToken = Extract<LocalizableString, { $l10n: string }>;

export type ResolvedLocalizable<T> = JsonValue extends T
  ? T
  : T extends LocalizedStringToken
    ? string
    : T extends readonly unknown[]
      ? { [Index in keyof T]: ResolvedLocalizable<T[Index]> }
      : T extends object
        ? { [TKey in keyof T]: ResolvedLocalizable<T[TKey]> }
        : T;

export type ResolvedWorkbenchExtensionMetadata = ResolvedLocalizable<WorkbenchExtensionMetadata>;
type ResolvedAppearanceRecord<T> = Omit<T, "title" | "description"> & { title: string; description?: string };
export type ResolvedWorkbenchExtensionAppearance = Omit<
  ListExtensionAppearanceResponse,
  "themes" | "fileIconThemes"
> & {
  themes: ResolvedAppearanceRecord<ListExtensionAppearanceResponse["themes"][number]>[];
  fileIconThemes: ResolvedAppearanceRecord<ListExtensionAppearanceResponse["fileIconThemes"][number]>[];
};

type TranslationRecord = ListExtensionAppearanceResponse["translations"][number];
// Each project owns its bundle revisions while retained workbenches coexist.
// Registration disposers need their revisions intact when the owner is disposed.
const translations = createRuntimeState(() => new Map<string, TranslationRecord[]>());
const namespaceFor = (extensionId: string, owner = getRuntimeCollections(), projectId?: string) =>
  `ext:${JSON.stringify([owner.id, projectId ?? null, extensionId])}`;

export const getExtensionPresentationLocale = () => JSON.stringify([i18n.language, i18n.languages]);

const isLocalizedString = (value: unknown): value is Extract<LocalizableString, { $l10n: string }> =>
  typeof value === "object" &&
  value !== null &&
  "$l10n" in value &&
  typeof (value as { $l10n?: unknown }).$l10n === "string";

const interpolate = (value: string, args?: Record<string, unknown>) =>
  Object.entries(args ?? {}).reduce(
    (next, [key, replacement]) => next.replaceAll(`{{${key}}}`, String(replacement)),
    value,
  );

export const resolveLocalizableString = (
  value: LocalizableString | undefined,
  extensionId?: string,
  args?: Record<string, unknown>,
  owner = getRuntimeCollections(),
  projectId?: string,
) => {
  if (value === undefined) return "";
  if (!isLocalizedString(value)) return value;

  const defaultValue = value.default ?? value.$l10n;
  if (!extensionId) return interpolate(defaultValue, args);

  return i18n.t(value.$l10n, {
    defaultValue,
    // The global language hierarchy already includes locale and fallback variants.
    // Rebuilding it for every label repeatedly canonicalizes the same locale codes.
    lngs: i18n.languages,
    ns: namespaceFor(extensionId, owner, projectId),
    replace: args,
  });
};

const resolveValue = (
  value: unknown,
  extensionId: string | undefined,
  owner = getRuntimeCollections(),
  projectId?: string,
  labels = new Map<string, string>(),
): unknown => {
  if (isLocalizedString(value)) {
    const key = JSON.stringify([extensionId, value.$l10n, value.default]);
    const cached = labels.get(key);
    if (cached !== undefined) return cached;
    const resolved = resolveLocalizableString(value, extensionId, undefined, owner, projectId);
    labels.set(key, resolved);
    return resolved;
  }
  if (Array.isArray(value)) {
    let next: unknown[] | undefined;
    for (let index = 0; index < value.length; index++) {
      const item = resolveValue(value[index], extensionId, owner, projectId, labels);
      if (item !== value[index]) {
        next ??= value.slice();
        next[index] = item;
      }
    }
    return next ?? value;
  }
  if (typeof value !== "object" || value === null) return value;

  const nextExtensionId =
    "extensionId" in value && typeof (value as { extensionId?: unknown }).extensionId === "string"
      ? (value as { extensionId: string }).extensionId
      : extensionId;
  // Large theme and schema payloads usually contain no labels. Retain those branches
  // instead of cloning the whole catalog on every project switch and locale refresh.
  const record = value as Record<string, unknown>;
  let next: Record<string, unknown> | undefined;
  for (const key of Object.keys(record)) {
    const item = resolveValue(record[key], nextExtensionId, owner, projectId, labels);
    if (item !== record[key]) {
      next ??= { ...record };
      next[key] = item;
    }
  }
  return next ?? value;
};

export const localizeExtensionMetadata = (
  metadata: WorkbenchExtensionMetadata,
  owner = getRuntimeCollections(),
  projectId?: string,
) => resolveValue(metadata, undefined, owner, projectId) as ResolvedWorkbenchExtensionMetadata;

// Deep-resolves any `l10n()` tokens in an arbitrary value (e.g. a command result whose
// labels the extension localized) against the extension's translation bundle.
export const localizeExtensionValue = (
  value: unknown,
  extensionId?: string,
  owner = getRuntimeCollections(),
  projectId?: string,
) => resolveValue(value, extensionId, owner, projectId);

const localizeAppearanceRecord = <
  T extends { extensionId: string; title: LocalizableString; description?: LocalizableString },
>(
  record: T,
  owner: ReturnType<typeof getRuntimeCollections>,
  projectId?: string,
) => ({
  ...record,
  title: resolveLocalizableString(record.title, record.extensionId, undefined, owner, projectId),
  description:
    record.description === undefined
      ? undefined
      : resolveLocalizableString(record.description, record.extensionId, undefined, owner, projectId),
});

export const localizeExtensionAppearance = (
  appearance: ListExtensionAppearanceResponse,
  owner = getRuntimeCollections(),
  projectId?: string,
) => ({
  ...appearance,
  // Theme assets, icon definitions and translation dictionaries contain literal data.
  // Only the record's declared labels accept localization tokens.
  themes: appearance.themes.map((record) => localizeAppearanceRecord(record, owner, projectId)),
  fileIconThemes: appearance.fileIconThemes.map((record) => localizeAppearanceRecord(record, owner, projectId)),
});

const removeBundles = (namespace: string, revision: TranslationRecord | undefined) => {
  for (const locale of Object.keys(revision?.bundles ?? {})) i18n.removeResourceBundle(locale, namespace);
};

const addBundles = (namespace: string, revision: TranslationRecord | undefined) => {
  for (const [locale, bundle] of Object.entries(revision?.bundles ?? {})) {
    i18n.addResourceBundle(locale, namespace, bundle, true, true);
  }
};

export const registerExtensionTranslationBundles = (
  appearance: ListExtensionAppearanceResponse,
  owner = getRuntimeCollections(),
  projectId?: string,
) => {
  const translationRecords = translations(owner);
  const registered = new Map<string, (typeof appearance.translations)[number]>();

  for (const record of appearance.translations ?? []) {
    const namespace = namespaceFor(record.extensionId, owner, projectId);
    const revisions = translationRecords.get(namespace) ?? [];
    removeBundles(namespace, revisions.at(-1));
    // Each registration owns its revision, even when locale refresh reuses the input object.
    const revision = { ...record };
    translationRecords.set(namespace, [...revisions, revision]);
    registered.set(record.extensionId, revision);
    addBundles(namespace, revision);
  }

  const dispose = () => {
    for (const [extensionId, revision] of registered) {
      const namespace = namespaceFor(extensionId, owner, projectId);
      const revisions = translationRecords.get(namespace) ?? [];
      if (!revisions.includes(revision)) continue;
      const remaining = revisions.filter((candidate) => candidate !== revision);
      if (revisions.at(-1) === revision) {
        removeBundles(namespace, revision);
        addBundles(namespace, remaining.at(-1));
      }
      if (remaining.length > 0) translationRecords.set(namespace, remaining);
      else translationRecords.delete(namespace);
    }
  };
  const unsubscribe = owner.onDispose(dispose);
  return {
    dispose: () => {
      unsubscribe();
      dispose();
    },
  };
};

export const getExtensionTranslationContext = (
  extensionId: string,
  locale: string,
  owner = getRuntimeCollections(),
  projectId?: string,
) => {
  const record = translations(owner)
    .get(namespaceFor(extensionId, owner, projectId))
    ?.at(-1);
  if (!record) return { locale, defaultLocale: locale, bundle: {}, defaultBundle: {} };

  return {
    locale,
    defaultLocale: record.defaultLocale,
    bundle: record.bundles[locale] ?? {},
    defaultBundle: record.bundles[record.defaultLocale] ?? {},
  };
};

/** Capture the catalog's runtime and project for deferred labels and action callbacks. */
export const createExtensionStringResolver =
  (owner = getRuntimeCollections(), projectId?: string) =>
  (value: LocalizableString | undefined, extensionId?: string, args?: Record<string, unknown>) =>
    resolveLocalizableString(value, extensionId, args, owner, projectId);
export type ExtensionStringResolver = ReturnType<typeof createExtensionStringResolver>;
