import { Box, Button, Flex, NumberInput, Text, Textarea } from "@chakra-ui/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { $getNodeByKey } from "lexical";
import mermaid from "mermaid";
import { useEffect, useId, useRef, useState } from "react";
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

const MIN_ZOOM = 0;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

function clampZoom(value: number) {
  return Number(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)).toFixed(2));
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
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ pointerId: -1, x: 0, y: 0 });
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
    resetView();
    setIsEditing(false);
  };

  const cancelEditing = () => {
    setDraftCode(previewCode);
    setIsEditing(false);
  };

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" overflow="hidden" width="100%">
      <Flex justifyContent="flex-end" alignItems="center" gap="xs" paddingX="sm" paddingY="xs" bg="bg.muted">
        {!isEditing && !renderError && !isRendering ? (
          <NumberInput.Root
            size="xs"
            width="64px"
            defaultValue={"100"}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            formatOptions={{
              style: "percent",
            }}
            onValueChange={({ valueAsNumber }) => {
              if (Number.isNaN(valueAsNumber)) {
                return;
              }

              setZoom(clampZoom(valueAsNumber));
            }}
          >
            <NumberInput.Control />
            <NumberInput.Input aria-label="Zoom percentage" />
          </NumberInput.Root>
        ) : null}

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
        <Box paddingX="sm" paddingBottom="sm" background="bg.muted">
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
              borderRadius="sm"
              overflow="hidden"
              minHeight="160px"
              onWheel={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <Box
                transform={`translate(${offset.x}px, ${offset.y}px) scale(${zoom})`}
                transformOrigin="top left"
                cursor={isPanning ? "grabbing" : "grab"}
                touchAction="none"
                onPointerDown={(event) => {
                  panStartRef.current = {
                    pointerId: event.pointerId,
                    x: event.clientX - offset.x,
                    y: event.clientY - offset.y,
                  };
                  setIsPanning(true);
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (!isPanning || panStartRef.current.pointerId !== event.pointerId) {
                    return;
                  }

                  setOffset({
                    x: event.clientX - panStartRef.current.x,
                    y: event.clientY - panStartRef.current.y,
                  });
                }}
                onPointerUp={(event) => {
                  if (panStartRef.current.pointerId !== event.pointerId) {
                    return;
                  }

                  setIsPanning(false);
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={() => {
                  setIsPanning(false);
                }}
                css={{
                  "& img": {
                    display: "block",
                    width: "100%",
                    height: "auto",
                    userSelect: "none",
                  },
                }}
              >
                <img
                  alt="Mermaid diagram"
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup)}`}
                  draggable={false}
                />
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
