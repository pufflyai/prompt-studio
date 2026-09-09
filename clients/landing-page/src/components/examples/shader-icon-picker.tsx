import { Box, Button } from "@chakra-ui/react";
import { EXAMPLE_ICONS, type ExampleIcon } from "../../content/icon-set-content";
import { useToolDemoStyles } from "../../hooks/use-landing-styles";
import { DemoPanel } from "./demo-workbench";

interface ShaderIconPickerProps {
  selected: string;
  onSelect: (icon: ExampleIcon) => void;
}

export const ShaderIconPicker = (props: ShaderIconPickerProps) => {
  const { selected, onSelect } = props;
  const styles = useToolDemoStyles();
  return (
    <DemoPanel title="Your icon set" kind="editor">
      <Box css={styles.iconPicker} role="group" aria-label="Pick a shader icon">
        {EXAMPLE_ICONS.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            size="2xl"
            aria-label={`Use ${item.name}`}
            title={item.name}
            aria-pressed={selected === item.id}
            onClick={() => onSelect(item)}
          >
            <Box css={styles.tileSymbol}>
              <item.icon />
            </Box>
          </Button>
        ))}
      </Box>
    </DemoPanel>
  );
};
