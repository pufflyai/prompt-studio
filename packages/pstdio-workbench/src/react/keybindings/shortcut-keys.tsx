import { HStack, Text } from "@chakra-ui/react";
import { PaletteShortcut } from "@pstdio/ui";
import type { ResolvedShortcut } from "../../core/controllers/keyboard/shortcut-catalog";
import { shortcutDisplayKeys } from "../../core/controllers/keyboard/shortcut-menu";

interface WorkbenchShortcutKeysProps {
  shortcut: ResolvedShortcut;
  openingChord: string;
  ownerLabel?: string;
  catalog?: ResolvedShortcut[];
}

export const WorkbenchShortcutKeys = (props: WorkbenchShortcutKeysProps) => {
  const { shortcut, openingChord, ownerLabel, catalog } = props;
  const chooseExtension =
    shortcut.binding.layer === "extensions" && shortcut.keys[1] === shortcut.binding.sourceExtensionId?.toUpperCase();
  return (
    <HStack gap="2xs">
      {chooseExtension ? (
        <>
          <PaletteShortcut binding={[openingChord, "E"]} />
          <Text textStyle="label/XS/regular">{ownerLabel ?? shortcut.binding.sourceExtensionLabel ?? "Extension"}</Text>
        </>
      ) : null}
      <PaletteShortcut binding={shortcutDisplayKeys(shortcut, openingChord, catalog)} />
    </HStack>
  );
};
