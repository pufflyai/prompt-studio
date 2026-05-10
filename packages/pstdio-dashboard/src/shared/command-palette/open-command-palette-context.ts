import { createContext, useContext } from "react";

export const OpenCommandPaletteContext = createContext<(() => void) | null>(null);

export const useOpenCommandPalette = () => {
  const openCommandPalette = useContext(OpenCommandPaletteContext);
  if (!openCommandPalette) {
    throw new Error("Command palette is unavailable outside ShortcutProvider.");
  }

  return openCommandPalette;
};
