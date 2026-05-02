import type { CommandPanelContribution, CommandSource } from "@pstdio/sdk/extensions";
import type { ExtensionRuntime, RuntimeCommandRecord } from "../types/runtime";

export type CommandPanelEntry = {
  command: RuntimeCommandRecord;
  group?: string;
  keywords: string[];
};

const isVisible = (command: RuntimeCommandRecord) => command.commandPanel !== false;

const matchesQuery = (entry: CommandPanelEntry, query: string) => {
  const haystack = [entry.command.title, entry.command.description ?? "", entry.command.id, ...entry.keywords]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
};

const matchesSource = (panel: CommandPanelContribution | false, source: CommandSource | undefined) => {
  if (panel === false) return false;
  if (!source) return true;

  const allowed = panel.when?.source;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(source);
};

/**
 * Filter commands for the command panel by query string and invocation source.
 * Pure read of the runtime registry — browser-safe.
 */
export const filterCommandPanel = (
  runtime: Pick<ExtensionRuntime, "commands">,
  options: { query?: string; source?: CommandSource } = {},
): CommandPanelEntry[] => {
  const entries: CommandPanelEntry[] = [];

  for (const command of runtime.commands) {
    if (!isVisible(command)) continue;
    if (!matchesSource(command.commandPanel, options.source)) continue;

    const panel = command.commandPanel === false ? undefined : command.commandPanel;
    const entry: CommandPanelEntry = {
      command,
      group: panel?.group,
      keywords: panel?.keywords ?? [],
    };

    if (options.query && !matchesQuery(entry, options.query)) continue;
    entries.push(entry);
  }

  return entries.sort((a, b) => a.command.title.localeCompare(b.command.title));
};

export const groupCommandPanel = (entries: CommandPanelEntry[]) => {
  const buckets = new Map<string, CommandPanelEntry[]>();

  for (const entry of entries) {
    const key = entry.group ?? "";
    const bucket = buckets.get(key) ?? [];
    bucket.push(entry);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .map(([group, items]) => ({ group, items }))
    .sort((a, b) => a.group.localeCompare(b.group));
};
