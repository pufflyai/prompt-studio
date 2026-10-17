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
const translations = createRuntimeState(
  () => new Map<string, TranslationRecord>(),
  (records) => records.clear(),
);
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
    ns: namespaceFor(extensionId, owner),
    replace: args,
  });
};

const resolveValue = (value: unknown, extensionId: string | undefined, owner = getRuntimeCollections()): unknown => {
  if (isLocalizedString(value)) return resolveLocalizableString(value, extensionId, undefined, owner);
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, extensionId, owner));
  if (typeof value !== "object" || value === null) return value;

  const nextExtensionId =
    "extensionId" in value && typeof (value as { extensionId?: unknown }).extensionId === "string"
      ? (value as { extensionId: string }).extensionId
      : extensionId;
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) next[key] = resolveValue(item, nextExtensionId, owner);
  return next;
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
  const registered: Array<{ locale: string; namespace: string }> = [];
  const extensionIds = new Set<string>();

  for (const record of appearance.translations ?? []) {
    const namespace = namespaceFor(record.extensionId, owner);
    translationRecords.set(record.extensionId, record);
    extensionIds.add(record.extensionId);
    for (const [locale, bundle] of Object.entries(record.bundles)) {
      i18n.addResourceBundle(locale, namespace, bundle, true, true);
      registered.push({ locale, namespace });
    }
  }

  const dispose = () => {
    for (const { locale, namespace } of registered) {
      if (i18n.hasResourceBundle(locale, namespace)) i18n.removeResourceBundle(locale, namespace);
    }
    for (const extensionId of extensionIds) translationRecords.delete(extensionId);
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
