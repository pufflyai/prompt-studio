import type { ParamObjectSchema, ParamOptionSource } from "@pstdio/sdk/extensions";
import type { ExtensionRuntime } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import { resolveContributionRefId } from "./references";

const isValueRef = (value: unknown): value is { kind: "param-value"; key: string } =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === "param-value" &&
  "key" in value &&
  typeof value.key === "string";

const validSource = (source: ParamOptionSource) =>
  source?.command && typeof source.valueField === "string" && typeof source.labelField === "string";

export const validateParamOptions = (runtime: ExtensionRuntime) => {
  const commandIds = new Set(runtime.commands.map((command) => command.id));
  const normalize = (schema: ParamObjectSchema | undefined, owner: { extensionId: string; sourcePath: string }) => {
    if (!schema) return schema;
    const edges = new Map<string, string[]>();
    const error = (code: string, message: string) =>
      runtime.diagnostics.push(createDiagnostic({ ...owner, code, message }));
    const normalized = Object.fromEntries(
      Object.entries(schema).map(([key, param]) => {
        if ((param.type !== "select" && param.type !== "multi-select") || Array.isArray(param.options))
          return [key, param];
        const source = param.options as ParamOptionSource;
        if (!validSource(source)) {
          error(
            "invalid_param_option_source",
            `Parameter "${key}" needs an option command, valueField and labelField.`,
          );
          return [key, param];
        }
        const command = { ...source.command, extensionId: source.command.extensionId ?? owner.extensionId };
        const commandId = resolveContributionRefId(owner.extensionId, command);
        if (!commandIds.has(commandId))
          error("unknown_param_option_command", `Parameter "${key}" refers to unknown command "${commandId}".`);
        const dependencies = Object.values(source.params ?? {})
          .filter(isValueRef)
          .map((ref) => ref.key);
        edges.set(key, dependencies);
        for (const dependency of dependencies) {
          if (!Object.hasOwn(schema, dependency))
            error("unknown_param_option_field", `Parameter "${key}" refers to unknown field "${dependency}".`);
        }
        return [key, { ...param, options: { ...source, command } }];
      }),
    );
    const done = new Set<string>();
    const visiting = new Set<string>();
    const visit = (key: string): boolean => {
      if (visiting.has(key)) return true;
      if (done.has(key)) return false;
      visiting.add(key);
      const cyclic = (edges.get(key) ?? []).some(visit);
      visiting.delete(key);
      done.add(key);
      return cyclic;
    };
    if ([...edges.keys()].some(visit))
      error("param_option_dependency_cycle", "Parameter option dependencies contain a cycle.");
    return normalized as ParamObjectSchema;
  };
  const rejectUnsupported = (
    schema: ParamObjectSchema | undefined,
    owner: { extensionId: string; sourcePath: string },
  ) => {
    for (const [key, param] of Object.entries(schema ?? {})) {
      if ((param.type === "select" || param.type === "multi-select") && !Array.isArray(param.options)) {
        runtime.diagnostics.push(
          createDiagnostic({
            ...owner,
            code: "unsupported_param_option_source",
            message: `Parameter "${key}" uses command-backed options outside a command dialog. Use fixed options on this surface.`,
          }),
        );
      }
    }
  };
  for (const workspace of runtime.workspaceTypes) rejectUnsupported(workspace.provider.params, workspace);
  for (const harness of runtime.harnesses) rejectUnsupported(harness.provider.params, harness);
  for (const command of runtime.commands) command.params = normalize(command.params, command) ?? {};
  for (const view of runtime.views) {
    const body = view.contribution.body;
    if (body.kind === "kanban") rejectUnsupported(body.createRow?.params, view);
    if (body.kind !== "dataTable" && body.kind !== "kanban") continue;
    if ((body.toolbarActions?.filter((action) => action.presentation === "primary").length ?? 0) > 1) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "multiple_primary_toolbar_actions",
          severity: "warning",
          extensionId: view.extensionId,
          sourcePath: view.sourcePath,
          message: `View "${view.localId}" declares more than one primary toolbar action.`,
        }),
      );
    }
    body.toolbarActions = body.toolbarActions?.map((action) => {
      const id = resolveContributionRefId(view.extensionId, action.command);
      if (!commandIds.has(id))
        runtime.diagnostics.push(
          createDiagnostic({
            code: "unknown_toolbar_action_command",
            extensionId: view.extensionId,
            sourcePath: view.sourcePath,
            message: `Toolbar action "${action.id}" refers to unknown command "${id}".`,
          }),
        );
      return { ...action, input: normalize(action.input, view) };
    });
  }
};
