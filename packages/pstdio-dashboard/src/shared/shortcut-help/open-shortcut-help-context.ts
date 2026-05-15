import { createContext, useContext } from "react";

export const OpenShortcutHelpContext = createContext<(() => void) | null>(null);

export const useOpenShortcutHelp = () => {
  const openShortcutHelp = useContext(OpenShortcutHelpContext);
  if (!openShortcutHelp) {
    throw new Error("Shortcut help is unavailable outside ShortcutProvider.");
  }

  return openShortcutHelp;
};
