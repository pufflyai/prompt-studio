import { Box, Button, Flex, Textarea } from "@chakra-ui/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { $getNodeByKey } from "lexical";
import { useEffect, useState } from "react";
import { MermaidRenderer } from "@/components/mermaid-renderer";
import { $isMermaidNode } from "./MermaidNode";

interface MermaidComponentProps {
  code: string;
  nodeKey: string;
}

export default function MermaidComponent(props: MermaidComponentProps) {
  const { code, nodeKey } = props;
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const [isEditing, setIsEditing] = useState(false);
  const [draftCode, setDraftCode] = useState(code);
  const [previewCode, setPreviewCode] = useState(code);

  useEffect(() => {
    setDraftCode(code);
    setPreviewCode(code);
  }, [code]);

  const commitCodeChanges = () => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isMermaidNode(node)) {
        node.setCode(draftCode);
      }
    });

    setPreviewCode(draftCode);
    setIsEditing(false);
  };

  const cancelEditing = () => {
    setDraftCode(previewCode);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <MermaidRenderer
        key={previewCode}
        code={previewCode}
        isEditable={isEditable}
        onRequestEdit={isEditable ? () => setIsEditing(true) : undefined}
      />
    );
  }

  return (
    <Box borderWidth="1px" borderColor="border.subtle" borderRadius="md" overflow="hidden" width="100%">
      <Flex justifyContent="flex-end" alignItems="center" gap="xs" paddingX="sm" paddingY="xs" bg="bg.muted">
        <Button size="xs" variant="subtle" onClick={cancelEditing}>
          Cancel
        </Button>
        <Button size="xs" onClick={commitCodeChanges}>
          Preview
        </Button>
      </Flex>
      <Box padding="sm" bg="bg.muted">
        <Textarea
          value={draftCode}
          onChange={(event) => setDraftCode(event.target.value)}
          minHeight="180px"
          resize="vertical"
          fontFamily="mono"
          fontSize="sm"
          spellCheck={false}
        />
      </Box>
    </Box>
  );
}
