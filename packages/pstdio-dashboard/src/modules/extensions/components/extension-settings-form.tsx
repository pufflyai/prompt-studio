import { Stack } from "@chakra-ui/react";
import type { ExtensionSettingValueRecord } from "@pstdio/sdk/api";
import { ParamEditorRow } from "@pstdio/ui/param-editor";
import { CommandOptionStatus, type ExecuteOptionCommand, useCommandOptions } from "@pstdio/workbench/react";
import { Fragment } from "react";
import {
  settingChangeValue,
  settingsToOptionValues,
  settingsToParamSchema,
  settingsToParams,
  settingsToValues,
} from "./extension-settings-params";

export interface ExtensionSettingsFormProps {
  settings: ExtensionSettingValueRecord[];
  executeOptionCommand: ExecuteOptionCommand;
  /** `undefined` removes the saved value. */
  onChangeSetting: (key: string, value: unknown) => void;
}

// The loader clears a selection its options no longer list. A saved setting must stay
// as it is, so the form ignores that request.
const keepSavedValue = () => {};

// The option loader reads its sources once, so a reload that changes them needs a new loader.
export const ExtensionSettingsForm = (props: ExtensionSettingsFormProps) => (
  <ExtensionSettingsFields key={JSON.stringify(settingsToParamSchema(props.settings))} {...props} />
);

const ExtensionSettingsFields = (props: ExtensionSettingsFormProps) => {
  const { settings, executeOptionCommand, onChangeSetting } = props;
  const schema = settingsToParamSchema(settings);
  const values = settingsToValues(settings);
  const options = useCommandOptions(schema, settingsToOptionValues(settings), executeOptionCommand, keepSavedValue);

  // Fields carry the param editor's own row padding, like a command dialog.
  return (
    <Stack gap="0">
      {settingsToParams(settings, options.states).map((param) => (
        <Fragment key={param.id}>
          <ParamEditorRow
            param={param}
            values={values}
            variant="small"
            onChange={(id, value) => onChangeSetting(id, settingChangeValue(settings, id, value))}
          />
          {settings.some((record) => record.key === param.id && record.options) ? (
            <CommandOptionStatus state={options.states[param.id]} onRetry={() => options.retry(param.id)} />
          ) : null}
        </Fragment>
      ))}
    </Stack>
  );
};
