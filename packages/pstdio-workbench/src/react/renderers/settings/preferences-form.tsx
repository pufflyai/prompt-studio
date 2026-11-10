import { Stack, Text } from "@chakra-ui/react";
import { SettingsActions } from "@pstdio/ui";
import { ParamEditor } from "@pstdio/ui/param-editor";
import { useContext, useState } from "react";
import type { PreferenceRegistry, PreferenceScope } from "../../../core";
import { SettingsPageContext, useSettingsChanges } from "../../settings/settings-page-context";
import { usePreferenceFormDraft } from "./preference-form-draft";
import { paramValueToPreference, preferenceSchemaToParams } from "./preference-schema-to-params";
import { type ScopedPreferenceEntry, usePreferenceEntries } from "./use-preference-entries";

export interface WorkbenchPreferencesFormProps {
  preferences: PreferenceRegistry;
  /** Preference names to edit; an object form overrides the displayed label. */
  names: (string | { name: string; label?: string })[];
  /** Resolves the scopeId for a preference's scope (e.g. "project" -> active project id). */
  resolveScopeId?: (scope: PreferenceScope) => string | undefined;
  /** "live" persists on change (default); "apply" stages edits behind Save/Reset. */
  mode?: "live" | "apply";
}

const registryIds = new WeakMap<PreferenceRegistry, number>();
let nextRegistry = 0;
const registryId = (preferences: PreferenceRegistry) => {
  let id = registryIds.get(preferences);
  if (id === undefined) {
    id = ++nextRegistry;
    registryIds.set(preferences, id);
  }
  return id;
};

const PreferenceFormBody = ({
  preferences,
  entries,
  mode,
}: {
  preferences: PreferenceRegistry;
  entries: ScopedPreferenceEntry[];
  mode: "live" | "apply";
}) => {
  const settingsPage = useContext(SettingsPageContext);
  const [formKey, setFormKey] = useState(0);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const draft = usePreferenceFormDraft((name, value) => {
    const entry = byName.get(name);
    if (entry) return preferences.setValue(name, paramValueToPreference(entry.schema, value), entry.scope);
  }, mode);
  const dirty = Object.keys(draft.staged).length > 0;
  const errors = Object.values(draft.errors);
  const changes = {
    dirty,
    saving: draft.saving,
    onSave: draft.save,
    onReset: () => {
      draft.discard();
      setFormKey((key) => key + 1);
    },
  };
  useSettingsChanges(mode === "apply" || dirty || draft.saving ? changes : undefined);
  return (
    <Stack gap="md">
      <ParamEditor
        changeDelay={0}
        key={formKey}
        params={preferenceSchemaToParams(entries)}
        defaultValues={draft.staged}
        onChange={(name, value) => {
          if (byName.has(name)) draft.change(name, value);
        }}
        fullWidth
      />
      {errors.length ? (
        <Text role="alert" color="fg.error">
          {errors.join("; ")}
        </Text>
      ) : null}
      {!settingsPage && (mode === "apply" || errors.length > 0) ? <SettingsActions {...changes} /> : null}
    </Stack>
  );
};

export const WorkbenchPreferencesForm = (props: WorkbenchPreferencesFormProps) => {
  const entries = usePreferenceEntries(props.preferences, props.names, props.resolveScopeId);
  // A different registry or project owns a different draft and pending UI continuation.
  const identity = JSON.stringify([
    registryId(props.preferences),
    props.mode,
    entries.map(({ name, scope }) => [name, scope]),
  ]);
  return (
    <PreferenceFormBody key={identity} preferences={props.preferences} entries={entries} mode={props.mode ?? "live"} />
  );
};
