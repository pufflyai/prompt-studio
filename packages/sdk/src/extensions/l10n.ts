export interface LocalizedString {
  readonly $l10n: string;
  readonly default?: string;
}

export type Localizable<T extends string = string> = T | LocalizedString;

export const l10n = (key: string, defaultValue?: string) => ({
  $l10n: key,
  ...(defaultValue === undefined ? {} : { default: defaultValue }),
});

export const isLocalizedString = (value: unknown): value is LocalizedString =>
  typeof value === "object" &&
  value !== null &&
  "$l10n" in value &&
  typeof (value as { $l10n?: unknown }).$l10n === "string";
