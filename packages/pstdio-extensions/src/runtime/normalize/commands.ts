import { normalizeCliPath } from "../../artifacts/path-normalization";
import type { NormalizedExtension, RuntimeCliContribution, RuntimeCommandRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";
import { asLocalizableString, isLocalizableString } from "./localizable";
import { hasCompatibleSlotKind } from "./slot-kind";
import { hasCompatibleWorkbenchTarget } from "./workbench-targets";

const splitCommandKey = (key: string) => key.split(".");

const normalizeCommandPalette = (palette: unknown): RuntimeCommandRecord["palette"] => {
  if (palette === undefined || palette === false) return [];
  if (palette === true) return [{}];
  if (Array.isArray(palette)) return palette.filter(isRecord) as RuntimeCommandRecord["palette"];
  return isRecord(palette) ? ([palette] as RuntimeCommandRecord["palette"]) : [];
};

const exampleUsesCommandPath = (example: string, routes: string[][]) => {
  const tokens = example.trim().split(/\s+/);
  if (tokens[0] !== "pstdio" && tokens[0] !== "pst") return false;
  const commandTokens = tokens.slice(1);
  return routes.some(
    (route) =>
      route.length <= commandTokens.length && route.every((segment, index) => commandTokens[index] === segment),
  );
};

const validateCliExamples = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  commandId: string,
  contribution: RuntimeCliContribution,
  runtime: Accumulator,
) => {
  const routes = [[ext.name, ...contribution.path], ...(contribution.globalAliases ?? [])];
  for (const example of contribution.examples ?? []) {
    if (exampleUsesCommandPath(example, routes)) continue;
    runtime.diagnostics.push(
      createDiagnostic({
        code: "invalid_cli_example",
        message: `CLI example for "${commandId}" does not use its command path or an alias`,
        extensionId: ext.id,
        commandId,
        sourcePath: source.sourcePath,
        metadata: { example },
      }),
    );
  }
};

const normalizeCommandCli = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  commandId: string,
  localId: string,
  cli: unknown,
  runtime: Accumulator,
  cliKeys: Map<string, RuntimeCliContribution>,
): RuntimeCliContribution | undefined => {
  if (cli === undefined || cli === false) return undefined;

  const customPath = isRecord(cli) && Array.isArray(cli.path) ? (cli.path as string[]) : splitCommandKey(localId);
  const normalized = normalizeCliPath(customPath);
  if (!normalized) return undefined;

  const pathKey = [ext.name, ...normalized.segments].join(" ");

  const contribution: RuntimeCliContribution = {
    extensionId: ext.id,
    commandId,
    name: ext.name,
    path: normalized.segments,
    pathKey,
    description: isRecord(cli) ? asLocalizableString(cli.description) : undefined,
    examples:
      isRecord(cli) && Array.isArray(cli.examples)
        ? cli.examples.filter((example): example is string => typeof example === "string")
        : undefined,
    hidden: isRecord(cli) && typeof cli.hidden === "boolean" ? cli.hidden : undefined,
    globalAliases:
      isRecord(cli) && Array.isArray(cli.globalAliases)
        ? (cli.globalAliases as string[][]).filter((alias) => Array.isArray(alias))
        : undefined,
  };
  validateCliExamples(ext, source, commandId, contribution, runtime);

  const existing = cliKeys.get(pathKey);
  if (existing) {
    runtime.diagnostics.push(
      createDiagnostic({
        code: "duplicate_cli_path",
        message: `CLI path "${pathKey}" is already provided by ${existing.commandId}`,
        extensionId: ext.id,
        commandId,
        metadata: {
          existingCommandId: existing.commandId,
          existingExtensionId: existing.extensionId,
          pathKey,
        },
        sourcePath: source.sourcePath,
      }),
    );
    return contribution;
  }

  cliKeys.set(pathKey, contribution);
  runtime.cli.push(contribution);
  return contribution;
};

export const registerCommandRecord = (record: RuntimeCommandRecord, runtime: Accumulator, index: RegistryIndex) => {
  const existing = index.commandIds.get(record.id);
  if (existing) {
    runtime.diagnostics.push(
      createDiagnostic({
        code: "duplicate_command_id",
        message: `Command id "${record.id}" is already provided by ${existing.sourcePath}`,
        extensionId: record.extensionId,
        commandId: record.id,
        sourcePath: record.sourcePath,
      }),
    );
    return false;
  }

  index.commandIds.set(record.id, record);
  runtime.commands.push(record);
  return true;
};

export const registerCommands = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, command] of Object.entries(source.definition.commands ?? {})) {
    const commandId = `${ext.name}.${localId}`;

    if (!isRecord(command) || !isLocalizableString(command.title) || typeof command.run !== "function") {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_command",
          message: `Command "${commandId}" must define title and run(ctx)`,
          extensionId: ext.id,
          commandId,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }

    const cli = normalizeCommandCli(ext, source, commandId, localId, command.cli, runtime, index.cliKeys);

    const menus = (Array.isArray(command.menus) ? command.menus : []).filter((menu, index) => {
      if (!isRecord(menu)) return false;
      if (typeof menu.target === "string") {
        return hasCompatibleWorkbenchTarget({
          runtime,
          source: { extensionId: ext.id, sourcePath: source.sourcePath },
          expected: "menu",
          target: menu.target,
          contributionId: `${commandId}.menu.${index}`,
        });
      }

      return hasCompatibleSlotKind({
        runtime,
        source: { extensionId: ext.id, sourcePath: source.sourcePath },
        expected: "menu",
        slot: menu.slot,
        contributionId: `${commandId}.menu.${index}`,
      });
    });

    const record: RuntimeCommandRecord = {
      id: commandId,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      title: command.title,
      description: asLocalizableString(command.description),
      params: isRecord(command.params) ? (command.params as RuntimeCommandRecord["params"]) : {},
      menus: menus as RuntimeCommandRecord["menus"],
      palette: normalizeCommandPalette(command.palette),
      cli,
      run: command.run as RuntimeCommandRecord["run"],
    };

    registerCommandRecord(record, runtime, index);
  }
};
