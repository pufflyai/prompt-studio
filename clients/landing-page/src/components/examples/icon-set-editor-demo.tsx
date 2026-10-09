import { Box, Button, Field, HStack, Input, Text } from "@chakra-ui/react";
import { useState } from "react";
import { EXAMPLE_ICONS, type ExampleIcon, LANDING_PREVIEW_ICON_IDS } from "../../content/icon-set-content";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { useDemoCli } from "../../hooks/use-demo-cli";
import { DemoContribution, useDemoComposition } from "../../hooks/use-demo-composition";
import { useToolDemoStyles } from "../../hooks/use-landing-styles";
import { BlockSymbol } from "../sections/building-blocks";
import { DemoPanel } from "./demo-workbench";

interface IconInspectorProps {
  item: ExampleIcon;
  icons: ExampleIcon[];
  onRename: (name: string) => void;
}

const IconInspector = (props: IconInspectorProps) => {
  const { item, icons, onRename } = props;
  const [name, setName] = useState(item.name);
  const styles = useToolDemoStyles();
  const composition = useDemoComposition();
  const nextName = name.trim();
  const canRename = nextName !== "" && nextName !== item.name && !icons.some((icon) => icon.name === nextName);

  return (
    <Box
      as="form"
      css={styles.inspector}
      onSubmit={(event) => {
        event.preventDefault();
        if (canRename) onRename(nextName);
      }}
    >
      <Box css={styles.iconCanvas} role="img" aria-label={`Icon preview: ${item.name}`}>
        <Box css={styles.inspectorSymbol}>
          <item.icon />
        </Box>
      </Box>
      <Field.Root>
        <Field.Label>Name</Field.Label>
        <Input value={name} onChange={(event) => setName(event.target.value)} aria-label="Icon name" />
      </Field.Root>
      {!composition && (
        <Field.Root>
          <Field.Label>Codepoint</Field.Label>
          <Input value={`U+${item.codepoint}`} readOnly aria-label="Icon codepoint" />
        </Field.Root>
      )}
      <DemoContribution kind="command">
        <Button type="submit" variant="outline" disabled={!canRename} data-demo-part="command">
          <BlockSymbol kind="command" />
          Rename icon
        </Button>
      </DemoContribution>
    </Box>
  );
};

export const IconSetEditorDemo = (props: { highlighted?: ToolShapeKind }) => {
  const { highlighted } = props;
  const [icons, setIcons] = useState(EXAMPLE_ICONS);
  const [selected, setSelected] = useState(icons[0].id);
  const [query, setQuery] = useState("");
  const item = icons.find((icon) => icon.id === selected)!;
  const search = query.trim().toLowerCase();
  const composition = useDemoComposition();
  const matchingIcons = icons.filter((icon) => `${icon.name} U+${icon.codepoint}`.toLowerCase().includes(search));
  let visibleIcons = matchingIcons;
  if (composition)
    visibleIcons = search
      ? matchingIcons.slice(0, LANDING_PREVIEW_ICON_IDS.length)
      : matchingIcons.filter((icon) => LANDING_PREVIEW_ICON_IDS.includes(icon.id));
  const hostRef = useDemoCli("icons", (command) => {
    setSelected(command.id);
    setIcons((current) => current.map((icon) => (icon.id === command.id ? { ...icon, name: command.name } : icon)));
  });
  const styles = useToolDemoStyles();

  return (
    <Box ref={hostRef} css={styles.iconEditor}>
      <DemoPanel title="Your icon set" kind="page" highlighted={highlighted}>
        <HStack css={styles.toolbar}>
          <Text textStyle="label/S/regular" color="fg.muted" aria-live="polite">
            {visibleIcons.length} icons
          </Text>
          <Text textStyle="mono/XS" color="fg.muted">
            prompt-studio-icons
          </Text>
        </HStack>
        <Input
          placeholder="Search by name or codepoint"
          aria-label="Search icons"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Box css={styles.iconGrid} role="group" aria-label="Select an icon">
          {visibleIcons.map((icon) => (
            <Box
              as="button"
              key={icon.id}
              css={styles.iconTile}
              data-icon-id={icon.id}
              aria-label={`Select icon ${icon.name}`}
              aria-pressed={icon.id === selected}
              onClick={() => setSelected(icon.id)}
            >
              <Box css={styles.tileSymbol}>
                <icon.icon />
              </Box>
              <Text css={styles.iconName}>{icon.name}</Text>
              {!composition && (
                <Text textStyle="mono/XS" color="fg.muted">
                  U+{icon.codepoint}
                </Text>
              )}
            </Box>
          ))}
        </Box>
        {visibleIcons.length === 0 && (
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            No icons match your search.
          </Text>
        )}
      </DemoPanel>
      <DemoPanel title="Icon inspector" kind="editor" highlighted={highlighted}>
        <IconInspector
          key={`${item.id}:${item.name}`}
          item={item}
          icons={icons}
          onRename={(name) => setIcons(icons.map((icon) => (icon.id === selected ? { ...icon, name } : icon)))}
        />
      </DemoPanel>
    </Box>
  );
};
