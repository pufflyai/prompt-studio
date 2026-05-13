import { createDisposable, type Disposable } from "../disposable";

export type ShellCommandPaletteChangeListener = (open: boolean) => void;

export interface ShellCommandPaletteController {
  isOpen(): boolean;
  open(): void;
  close(): void;
  toggle(): void;
  onDidChange(listener: ShellCommandPaletteChangeListener): Disposable;
}

export interface CreateShellCommandPaletteControllerInput {
  initialOpen?: boolean;
}

export const createShellCommandPaletteController = (
  input: CreateShellCommandPaletteControllerInput = {},
): ShellCommandPaletteController => {
  let open = input.initialOpen ?? false;
  const listeners = new Set<ShellCommandPaletteChangeListener>();

  const setOpen = (next: boolean) => {
    if (open === next) return;
    open = next;
    for (const listener of listeners) listener(open);
  };

  return {
    isOpen() {
      return open;
    },
    open() {
      setOpen(true);
    },
    close() {
      setOpen(false);
    },
    toggle() {
      setOpen(!open);
    },
    onDidChange(listener) {
      listeners.add(listener);
      return createDisposable(() => {
        listeners.delete(listener);
      });
    },
  };
};
