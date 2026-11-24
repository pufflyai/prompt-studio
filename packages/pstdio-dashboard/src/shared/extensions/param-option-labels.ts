import { isLocalizedString } from "@pstdio/sdk/extensions";

const selection = (record: Record<string, unknown>) =>
  (record.type === "select" || record.type === "multi-select") && Array.isArray(record.options);

const mapOptions = (record: Record<string, unknown>, map: (option: Record<string, unknown>) => unknown) => {
  if (!selection(record)) return record;
  const source = record.options as unknown[];
  const options = source.map((option) =>
    option && typeof option === "object" ? map(option as Record<string, unknown>) : option,
  );
  return options.some((option, index) => option !== source[index]) ? { ...record, options } : record;
};

export const withParamOptionDefaults = (record: Record<string, unknown>) =>
  mapOptions(record, (option) =>
    typeof option.label === "string" &&
    isLocalizedString(option.localizedLabel) &&
    option.localizedLabel.default === undefined
      ? { ...option, localizedLabel: { ...option.localizedLabel, default: option.label } }
      : option,
  );

export const withTranslatedParamOptions = (record: Record<string, unknown>) =>
  mapOptions(record, (option) =>
    typeof option.localizedLabel === "string" && option.label !== option.localizedLabel
      ? { ...option, label: option.localizedLabel }
      : option,
  );
