import { HStack, Stack, Text } from "@chakra-ui/react";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { EXAMPLE_ICONS } from "../../content/icon-set-content";
import { MATRIX_SHADER } from "../../content/shader-demo-content";
import { BlockSymbol } from "../sections/building-blocks";
import { ShaderEditorDemo } from "./shader-editor-demo";
import { ShaderIconPicker } from "./shader-icon-picker";

export const ConnectedShaderDemo = (props: { withControls: boolean }) => {
  const { withControls } = props;
  const [selectedIcon, setSelectedIcon] = useState(EXAMPLE_ICONS[11]);
  return (
    <Stack gap="panel-gap">
      <ShaderIconPicker selected={selectedIcon.id} onSelect={setSelectedIcon} />
      <HStack gap="sm" px="md" py="sm" flexWrap="wrap" textStyle="label/S/regular" aria-label="Connected tools">
        <BlockSymbol kind="editor" />
        <Text>Icon set</Text>
        <ArrowRight size={14} />
        <Text textStyle="mono/XS">{selectedIcon.name}</Text>
        <ArrowRight size={14} />
        <BlockSymbol kind="page" />
        <Text>Shader preview</Text>
      </HStack>
      <ShaderEditorDemo shader={MATRIX_SHADER} iconCodepoint={selectedIcon.codepoint} withControls={withControls} />
    </Stack>
  );
};
