import type { Localizable } from "@pstdio/sdk/extensions";
import { commandRefId } from "@pstdio/sdk/extensions";
import type { CommandParamSchema } from "../../core";

type LocalizableText = Localizable<string> | undefined;
type ParamLocalizer = (value: LocalizableText, fallback?: string) => string;

type ContributedParamSchema =
  | Record<string, { type: string; label?: LocalizableText; description?: LocalizableText; options?: unknown }>
  | undefined;

/**
 * Contribution params carry `Localizable` labels; the workbench's command
 * surfaces render plain strings. Resolve at the boundary so no l10n object
 * reaches a renderer and gets stringified as "[object Object]".
 */
export const localizeParamSchema = (
  params: ContributedParamSchema,
  localize: ParamLocalizer,
  ownerExtensionId?: string,
) => {
  if (!params) return undefined;

  return Object.fromEntries(
    Object.entries(params).map(([id, descriptor]) => [
      id,
      {
        ...descriptor,
        ...(descriptor.options && !Array.isArray(descriptor.options)
          ? { options: localizeOptionSource(descriptor.options, ownerExtensionId) }
          : {}),
        label: descriptor.label === undefined ? undefined : localize(descriptor.label, id),
        description: descriptor.description === undefined ? undefined : localize(descriptor.description),
      },
    ]),
  ) as CommandParamSchema;
};

const localizeOptionSource = (value: unknown, ownerExtensionId?: string) => {
  const source = value as {
    command: { id: string; extensionId?: string };
    valueField: string;
    labelField: string;
    params?: Record<string, unknown>;
  };
  return {
    valueField: source.valueField,
    labelField: source.labelField,
    params: source.params,
    commandId: commandRefId({
      id: source.command.id,
      extensionId: source.command.extensionId ?? ownerExtensionId ?? "pstdio",
    }),
  };
};
