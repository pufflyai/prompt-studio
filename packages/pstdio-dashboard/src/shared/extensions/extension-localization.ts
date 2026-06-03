import type { ListExtensionAppearanceResponse, LocalizableString, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import i18n from "@/i18n";

type LocalizedStringToken = Extract<LocalizableString, { $l10n: string }>;

export type ResolvedLocalizable<T> = T extends LocalizedStringToken
  ? string
  : T extends Array<infer TItem>
    ? ResolvedLocalizable<TItem>[]
    : T extends object
      ? { [TKey in keyof T]: ResolvedLocalizable<T[TKey]> }
      : T;

export type ResolvedWorkbenchExtensionMetadata = ResolvedLocalizable<WorkbenchExtensionMetadata>;
export type ResolvedWorkbenchExtensionAppearance = ResolvedLocalizable<ListExtensionAppearanceResponse>;

type TranslationRecord = ListExtensionAppearanceResponse["translations"][number];
const translationRecords = new Map<string, TranslationRecord>();

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
) => {
  if (value === undefined) return "";
  if (!isLocalizedString(value)) return value;

  const defaultValue = value.default ?? value.$l10n;
  if (!extensionId) return interpolate(defaultValue, args);

  return i18n.t(value.$l10n, {
    defaultValue,
    ns: `ext:${extensionId}`,
    replace: args,
  });
};

const resolveValue = (value: unknown, extensionId?: string): unknown => {
  if (isLocalizedString(value)) return resolveLocalizableString(value, extensionId);
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, extensionId));
  if (typeof value !== "object" || value === null) return value;

  const nextExtensionId =
    "extensionId" in value && typeof (value as { extensionId?: unknown }).extensionId === "string"
      ? (value as { extensionId: string }).extensionId
      : extensionId;
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) next[key] = resolveValue(item, nextExtensionId);
  return next;
};

export const localizeExtensionMetadata = (metadata: WorkbenchExtensionMetadata) =>
  resolveValue(metadata) as ResolvedWorkbenchExtensionMetadata;

export const localizeExtensionAppearance = (appearance: ListExtensionAppearanceResponse) =>
  resolveValue(appearance) as ResolvedWorkbenchExtensionAppearance;

export const registerExtensionTranslationBundles = (appearance: ListExtensionAppearanceResponse) => {
  const registered: Array<{ locale: string; namespace: string }> = [];
  const extensionIds = new Set<string>();

  for (const record of appearance.translations ?? []) {
    const namespace = `ext:${record.extensionId}`;
    translationRecords.set(record.extensionId, record);
    extensionIds.add(record.extensionId);
    for (const [locale, bundle] of Object.entries(record.bundles)) {
      i18n.addResourceBundle(locale, namespace, bundle, true, true);
      registered.push({ locale, namespace });
    }
  }

  return {
    dispose() {
      for (const { locale, namespace } of registered) {
        if (i18n.hasResourceBundle(locale, namespace)) i18n.removeResourceBundle(locale, namespace);
      }
      for (const extensionId of extensionIds) translationRecords.delete(extensionId);
    },
  };
};

export const getExtensionTranslationContext = (extensionId: string, locale: string) => {
  const record = translationRecords.get(extensionId);
  if (!record) return { locale, defaultLocale: locale, bundle: {}, defaultBundle: {} };

  return {
    locale,
    defaultLocale: record.defaultLocale,
    bundle: record.bundles[locale] ?? {},
    defaultBundle: record.bundles[record.defaultLocale] ?? {},
  };
};
