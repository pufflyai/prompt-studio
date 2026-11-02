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
export type ResolvedWorkbenchExtensionAppearance = ResolvedLocalizable<ListExtensionAppearanceResponse>;

type TranslationRecord = ListExtensionAppearanceResponse["translations"][number];
// Registration disposers need their revisions intact when the owner is disposed.
const translations = createRuntimeState(() => new Map<string, TranslationRecord>());
const namespaceFor = (extensionId: string, owner = getRuntimeCollections()) => `ext:${owner.id}:${extensionId}`;

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
    ns: namespaceFor(extensionId, owner),
    replace: args,
  });
};

const resolveValue = (
  value: unknown,
  extensionId: string | undefined,
  owner = getRuntimeCollections(),
  labels = new Map<string, string>(),
): unknown => {
  if (isLocalizedString(value)) {
    const key = JSON.stringify([extensionId, value.$l10n, value.default]);
    const cached = labels.get(key);
    if (cached !== undefined) return cached;
    const resolved = resolveLocalizableString(value, extensionId, undefined, owner);
    labels.set(key, resolved);
    return resolved;
  }
  if (Array.isArray(value)) {
    let next: unknown[] | undefined;
    for (let index = 0; index < value.length; index++) {
      const item = resolveValue(value[index], extensionId, owner, labels);
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
    const item = resolveValue(record[key], nextExtensionId, owner, labels);
    if (item !== record[key]) {
      next ??= { ...record };
      next[key] = item;
    }
  }
  return next ?? value;
};

export const localizeExtensionMetadata = (metadata: WorkbenchExtensionMetadata, owner = getRuntimeCollections()) =>
  resolveValue(metadata, undefined, owner) as ResolvedWorkbenchExtensionMetadata;

// Deep-resolves any `l10n()` tokens in an arbitrary value (e.g. a command result whose
// labels the extension localized) against the extension's translation bundle.
export const localizeExtensionValue = (value: unknown, extensionId?: string, owner = getRuntimeCollections()) =>
  resolveValue(value, extensionId, owner);

export const localizeExtensionAppearance = (
  appearance: ListExtensionAppearanceResponse,
  owner = getRuntimeCollections(),
) => resolveValue(appearance, undefined, owner) as ResolvedWorkbenchExtensionAppearance;

export const registerExtensionTranslationBundles = (
  appearance: ListExtensionAppearanceResponse,
  owner = getRuntimeCollections(),
) => {
  const translationRecords = translations(owner);
  const registered = new Map<string, (typeof appearance.translations)[number]>();

  for (const record of appearance.translations ?? []) {
    const namespace = namespaceFor(record.extensionId, owner);
    const previous = translationRecords.get(record.extensionId);
    for (const locale of Object.keys(previous?.bundles ?? {})) i18n.removeResourceBundle(locale, namespace);
    // Each registration owns its revision, even when locale refresh reuses the input object.
    const revision = { ...record };
    translationRecords.set(record.extensionId, revision);
    registered.set(record.extensionId, revision);
    for (const [locale, bundle] of Object.entries(record.bundles)) {
      i18n.addResourceBundle(locale, namespace, bundle, true, true);
    }
  }

  const dispose = () => {
    for (const [extensionId, revision] of registered) {
      if (translationRecords.get(extensionId) !== revision) continue;
      const namespace = namespaceFor(extensionId, owner);
      for (const locale of Object.keys(revision.bundles)) i18n.removeResourceBundle(locale, namespace);
      translationRecords.delete(extensionId);
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
) => {
  const record = translations(owner).get(extensionId);
  if (!record) return { locale, defaultLocale: locale, bundle: {}, defaultBundle: {} };

  return {
    locale,
    defaultLocale: record.defaultLocale,
    bundle: record.bundles[locale] ?? {},
    defaultBundle: record.bundles[record.defaultLocale] ?? {},
  };
};
