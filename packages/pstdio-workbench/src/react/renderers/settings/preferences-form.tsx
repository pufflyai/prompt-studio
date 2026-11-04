import { Button, HStack, Stack } from "@chakra-ui/react";
import { ParamEditor, type ParamEditorProps } from "@pstdio/ui/param-editor";
import { useContext, useState } from "react";
import type { PreferenceRegistry, PreferenceScope } from "../../../core";
import { SettingsPageContext, useSettingsChanges } from "../../settings/settings-page-context";
import {
  type PreferenceParamEntry,
  paramValueToPreference,
  preferenceSchemaToParams,
} from "./preference-schema-to-params";

type ParamValue = Parameters<NonNullable<ParamEditorProps["onChange"]>>[1];

export interface WorkbenchPreferencesFormProps {
  preferences: PreferenceRegistry;
  /** Preference names to edit; an object form overrides the displayed label. */
  names: (string | { name: string; label?: string })[];
  /** Resolves the scopeId for a preference's scope (e.g. "project" -> active project id). */
  resolveScopeId?: (scope: PreferenceScope) => string | undefined;
  /** "live" persists on change (default); "apply" stages edits behind Save/Discard. */
  mode?: "live" | "apply";
}

const toName = (entry: string | { name: string; label?: string }) =>
  typeof entry === "string" ? { name: entry } : entry;

// Renders a param editor auto-generated from the registered preference schema. The
// form is generic: it knows only about preference names + scope, never the domain.
export const WorkbenchPreferencesForm = (props: WorkbenchPreferencesFormProps) => {
  const { preferences, names, resolveScopeId, mode = "live" } = props;
  const settingsPage = useContext(SettingsPageContext);
  const [staged, setStaged] = useState<Record<string, ParamValue>>({});
  const [formKey, setFormKey] = useState(0);

  const scopeRef = (scope: PreferenceScope) => ({ scope, scopeId: resolveScopeId?.(scope) });

  const entries: PreferenceParamEntry[] = [];
  for (const candidate of names) {
    const { name, label } = toName(candidate);
    const schema = preferences.getSchema(name);
    if (!schema) continue;
    entries.push({ name, label, schema, value: preferences.getValue(name, scopeRef(schema.scope)) });
  }

  const params = preferenceSchemaToParams(entries);
  const schemaByName = new Map(entries.map((entry) => [entry.name, entry.schema]));

  const persist = (name: string, value: ParamValue) => {
    const schema = schemaByName.get(name);
    if (!schema) return;
    preferences.setValue(name, paramValueToPreference(schema, value), scopeRef(schema.scope));
  };

  const handleChange = (id: string, value: ParamValue) => {
    if (mode === "apply") {
      setStaged((current) => ({ ...current, [id]: value }));
      return;
    }
    persist(id, value);
  };

  const save = () => {
    for (const [name, value] of Object.entries(staged)) persist(name, value);
    setStaged({});
    setFormKey((key) => key + 1);
  };

  const discard = () => {
    setStaged({});
    setFormKey((key) => key + 1);
  };

  const hasStaged = Object.keys(staged).length > 0;

  useSettingsChanges(mode === "apply" ? { dirty: hasStaged, onSave: save, onReset: discard } : undefined);
  return (
    <Stack gap="md">
      <ParamEditor changeDelay={0} key={formKey} params={params} onChange={handleChange} fullWidth />
      {!settingsPage && mode === "apply" ? (
        <HStack gap="sm">
          <Button size="sm" disabled={!hasStaged} onClick={save}>
            Save
          </Button>
          <Button size="sm" variant="outline" disabled={!hasStaged} onClick={discard}>
            Discard
          </Button>
        </HStack>
      ) : null}
    </Stack>
  );
};
