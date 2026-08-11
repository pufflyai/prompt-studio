import type { ContextKeyService } from "../../shared/context/context-key-service";
import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { ResourceRef } from "../resources/resource-registry";

export interface WorkbenchCommandExecutionError {
  commandId: string;
  args: unknown;
  error: unknown;
}

export type WorkbenchCommandExecutionErrorListener = (event: WorkbenchCommandExecutionError) => void;

export interface WorkbenchCommandExecutionContext {
  resource?: ResourceRef;
  source?: "panel-add";
}

export interface CommandParamOption {
  label: string;
  value: string;
  icon?: string;
}

export interface CommandParamDescriptor {
  type: string;
  label?: string;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: CommandParamOption[];
  templateType?: string;
  resourceType?: string;
  metadata?: Record<string, unknown>;
}

export type CommandParamSchema = Record<string, CommandParamDescriptor>;

export interface Command {
  id: string;
  label: string;
  category?: string;
  description?: string;
  icon?: string;
  when?: string;
  params?: CommandParamSchema;
}

export interface CommandHandler<TArgs = unknown, TResult = unknown> {
  execute(args: TArgs, context?: WorkbenchCommandExecutionContext): TResult | Promise<TResult>;
  isEnabled?(args: TArgs): boolean;
  isVisible?(args: TArgs): boolean;
  isToggled?(args: TArgs): boolean;
}

export interface RegisteredCommand extends RegisteredContributionMetadata {
  command: Command;
  handler: CommandHandler;
}

export interface CommandRegistryStoreState {
  commands: Record<string, RegisteredCommand>;
}

export interface CommandRegistry {
  store: WorkbenchStore<CommandRegistryStoreState>;
  registerCommand<TArgs = unknown, TResult = unknown>(
    command: Command,
    handler: CommandHandler<TArgs, TResult>,
    metadata?: ContributionMetadata,
  ): Disposable;
  getCommand(id: string): RegisteredCommand | undefined;
  listCommands(): RegisteredCommand[];
  isCommandEnabled(id: string, args?: unknown): boolean;
  isCommandVisible(id: string, args?: unknown): boolean;
  isCommandToggled(id: string, args?: unknown): boolean;
  executeCommand(id: string, args?: unknown, context?: WorkbenchCommandExecutionContext): Promise<unknown>;
  onDidExecuteError(listener: WorkbenchCommandExecutionErrorListener): Disposable;
}

export interface CreateCommandRegistryInput {
  context?: ContextKeyService;
}

export const createCommandRegistry = (input: CreateCommandRegistryInput = {}): CommandRegistry => {
  const store = createWorkbenchStore<CommandRegistryStoreState>({
    name: "workbench.commands",
    initialState: { commands: {} },
  });

  const errorListeners = new Set<WorkbenchCommandExecutionErrorListener>();

  const requireCommand = (id: string) => {
    const record = store.getState().commands[id];
    if (!record) throw new Error(`Command not registered: ${id}`);
    return record;
  };

  const emitError = (event: WorkbenchCommandExecutionError) => {
    for (const listener of errorListeners) listener(event);
  };

  return {
    store,

    registerCommand(command, handler, metadata) {
      const snapshot = store.getState();
      if (snapshot.commands[command.id]) throw new Error(`Command already registered: ${command.id}`);

      const record: RegisteredCommand = {
        ...normalizeContributionMetadata(metadata),
        command,
        handler: handler as CommandHandler,
      };

      store.setState({ commands: { ...snapshot.commands, [command.id]: record } }, false, "registerCommand");

      return createDisposable(() => {
        const current = store.getState();
        if (current.commands[command.id] !== record) return;
        const { [command.id]: _removed, ...rest } = current.commands;
        store.setState({ commands: rest }, false, "unregisterCommand");
      });
    },

    getCommand(id) {
      return store.getState().commands[id];
    },

    listCommands() {
      return Object.values(store.getState().commands).sort(byContributionPriority);
    },

    isCommandEnabled(id, args) {
      return requireCommand(id).handler.isEnabled?.(args) ?? true;
    },

    isCommandVisible(id, args) {
      const record = requireCommand(id);
      if (!input.context?.matches(record.command.when)) return false;
      return record.handler.isVisible?.(args) ?? true;
    },

    isCommandToggled(id, args) {
      return requireCommand(id).handler.isToggled?.(args) ?? false;
    },

    async executeCommand(id, args, context) {
      const record = requireCommand(id);
      if (record.handler.isEnabled?.(args) === false) {
        const error = new Error(`Command is disabled: ${id}`);
        emitError({ commandId: id, args, error });
        throw error;
      }
      try {
        return await record.handler.execute(args, context);
      } catch (error) {
        emitError({ commandId: id, args, error });
        throw error;
      }
    },

    onDidExecuteError(listener) {
      errorListeners.add(listener);
      return createDisposable(() => {
        errorListeners.delete(listener);
      });
    },
  };
};
