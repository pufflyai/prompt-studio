import { Box, Button, Flex, Text, Textarea } from "@chakra-ui/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { $getNodeByKey } from "lexical";
import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";
import { $isMermaidNode } from "./MermaidNode";

let mermaidInitialized = false;

function initializeMermaid() {
  if (mermaidInitialized) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "default",
  });

  mermaidInitialized = true;
}

function formatErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Failed to render mermaid diagram.";
  }

  return error.message;
}

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
  const [svgMarkup, setSvgMarkup] = useState("");
  const [renderError, setRenderError] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const renderId = useId().replaceAll(":", "-");

  useEffect(() => {
    setDraftCode(code);
    setPreviewCode(code);
  }, [code]);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      initializeMermaid();
      setIsRendering(true);
      setRenderError("");

      try {
        const { svg } = await mermaid.render(`mermaid-${renderId}`, previewCode);
        if (!cancelled) {
          setSvgMarkup(svg);
        }
      } catch (error) {
        if (!cancelled) {
          setSvgMarkup("");
          setRenderError(formatErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    }

    if (!isEditing) {
      void renderDiagram();
    }

    return () => {
      cancelled = true;
    };
  }, [isEditing, previewCode, renderId]);

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

  return (
    <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" overflow="hidden" width="100%">
      <Flex justifyContent="space-between" alignItems="center" paddingX="sm" paddingY="xs" bg="bg.subtle">
        <Text textStyle="label/S/medium">Mermaid</Text>
        {isEditable ? (
          isEditing ? (
            <Flex gap="xs">
              <Button size="xs" variant="surface" onClick={cancelEditing}>
                Cancel
              </Button>
              <Button size="xs" onClick={commitCodeChanges}>
                Preview
              </Button>
            </Flex>
          ) : (
            <Button size="xs" variant="surface" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )
        ) : null}
      </Flex>

      {isEditing ? (
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
      ) : (
        <Box
          padding="sm"
          background="bg.muted"
          cursor={isEditable ? "pointer" : "default"}
          onClick={isEditable ? () => setIsEditing(true) : undefined}
        >
          {isRendering ? <Text color="fg.muted">Rendering diagram...</Text> : null}
          {renderError ? (
            <Box>
              <Text color="fg.error" textStyle="label/S/medium">
                Mermaid parse failed
              </Text>
              <Text color="fg.muted" textStyle="label/S/regular" marginTop="2xs">
                {renderError}
              </Text>
              <Box as="pre" marginTop="sm" padding="sm" borderRadius="sm" bg="bg.panel" overflowX="auto">
                {previewCode}
              </Box>
            </Box>
          ) : (
            <Box
              as="img"
              alt="Mermaid diagram"
              src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup)}`}
              maxWidth="100%"
            />
          )}
        </Box>
      )}
    </Box>
  );
}
