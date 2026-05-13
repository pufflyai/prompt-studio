import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../contributions/metadata";
import { createDisposable, type Disposable } from "../disposable";

export interface ShellCommandExecutionError {
  commandId: string;
  args: unknown;
  error: unknown;
}

export type ShellCommandExecutionErrorListener = (event: ShellCommandExecutionError) => void;

export interface Command {
  id: string;
  label: string;
  category?: string;
  description?: string;
  icon?: string;
}

export interface CommandHandler<TArgs = unknown, TResult = unknown> {
  execute(args: TArgs): TResult | Promise<TResult>;
  isEnabled?(args: TArgs): boolean;
  isVisible?(args: TArgs): boolean;
  isToggled?(args: TArgs): boolean;
}

export interface RegisteredCommand extends RegisteredContributionMetadata {
  command: Command;
  handler: CommandHandler;
}

export const createCommandRegistry = () => {
  const records = new Map<string, RegisteredCommand>();
  const errorListeners = new Set<ShellCommandExecutionErrorListener>();

  const findCommand = (id: string) => {
    const record = records.get(id);
    if (!record) throw new Error(`Command not registered: ${id}`);
    return record;
  };

  const emitError = (event: ShellCommandExecutionError) => {
    for (const listener of errorListeners) listener(event);
  };

  return {
    registerCommand<TArgs = unknown, TResult = unknown>(
      command: Command,
      handler: CommandHandler<TArgs, TResult>,
      metadata?: ContributionMetadata,
    ) {
      if (records.has(command.id)) throw new Error(`Command already registered: ${command.id}`);

      const record: RegisteredCommand = {
        ...normalizeContributionMetadata(metadata),
        command,
        handler: handler as CommandHandler,
      };

      records.set(command.id, record);

      return createDisposable(() => {
        if (records.get(command.id) === record) records.delete(command.id);
      });
    },

    getCommand(id: string) {
      return records.get(id);
    },

    listCommands() {
      return [...records.values()].sort(byContributionPriority);
    },

    isCommandEnabled(id: string, args?: unknown) {
      const record = findCommand(id);
      return record.handler.isEnabled?.(args) ?? true;
    },

    isCommandVisible(id: string, args?: unknown) {
      const record = findCommand(id);
      return record.handler.isVisible?.(args) ?? true;
    },

    isCommandToggled(id: string, args?: unknown) {
      const record = findCommand(id);
      return record.handler.isToggled?.(args) ?? false;
    },

    async executeCommand(id: string, args?: unknown) {
      const record = findCommand(id);
      if (record.handler.isEnabled?.(args) === false) {
        const error = new Error(`Command is disabled: ${id}`);
        emitError({ commandId: id, args, error });
        throw error;
      }
      try {
        return await record.handler.execute(args);
      } catch (error) {
        emitError({ commandId: id, args, error });
        throw error;
      }
    },

    onDidExecuteError(listener: ShellCommandExecutionErrorListener): Disposable {
      errorListeners.add(listener);
      return createDisposable(() => {
        errorListeners.delete(listener);
      });
    },
  };
};

export type CommandRegistry = ReturnType<typeof createCommandRegistry>;
