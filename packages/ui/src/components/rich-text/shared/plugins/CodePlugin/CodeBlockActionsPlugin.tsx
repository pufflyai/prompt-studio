import "./CodeBlockActionsPlugin.css";

import { IconButton } from "@chakra-ui/react";
import { $isCodeNode } from "@lexical/code";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_CRITICAL, SELECTION_CHANGE_COMMAND } from "lexical";
import { Check, Copy } from "lucide-react";
import type React from "react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Tooltip } from "../../../../tooltip";

function getCodeElementFromSelection(editor: ReturnType<typeof useLexicalComposerContext>[0]) {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return null;
  }

  const anchorNode = selection.anchor.getNode();
  const codeNode = $isCodeNode(anchorNode)
    ? anchorNode
    : $findMatchingParent(anchorNode, (node) => {
        return $isCodeNode(node);
      });

  if (!$isCodeNode(codeNode)) {
    return null;
  }

  const codeElement = editor.getElementByKey(codeNode.getKey());
  return codeElement instanceof HTMLElement ? codeElement : null;
}

function getCodeElementFromTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  return target.closest(".rich-text__code");
}

function getActionPosition(anchorElem: HTMLElement, codeElement: HTMLElement) {
  const anchorRect = anchorElem.getBoundingClientRect();
  const codeRect = codeElement.getBoundingClientRect();

  return {
    top: codeRect.top - anchorRect.top + 6,
    left: codeRect.right - anchorRect.left - 30,
  };
}

export function CodeBlockActionsPlugin({ anchorElem }: { anchorElem?: HTMLElement | null }): React.JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [activeCodeElement, setActiveCodeElement] = useState<HTMLElement | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const copyResetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const nextCodeElement = getCodeElementFromTarget(event.target);
      setActiveCodeElement(nextCodeElement instanceof HTMLElement ? nextCodeElement : null);
    };

    const handlePointerLeave = () => {
      editor.getEditorState().read(() => {
        const selectionCodeElement = getCodeElementFromSelection(editor);
        setActiveCodeElement(selectionCodeElement);
      });
    };

    rootElement.addEventListener("pointermove", handlePointerMove);
    rootElement.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      rootElement.removeEventListener("pointermove", handlePointerMove);
      rootElement.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selectionCodeElement = getCodeElementFromSelection(editor);
          if (selectionCodeElement) {
            setActiveCodeElement(selectionCodeElement);
          }
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          editor.getEditorState().read(() => {
            const selectionCodeElement = getCodeElementFromSelection(editor);
            if (!selectionCodeElement) {
              setActiveCodeElement((current) => {
                return current?.matches(":hover") ? current : null;
              });
              return;
            }

            setActiveCodeElement(selectionCodeElement);
          });

          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
  }, [editor]);

  if (!anchorElem || !activeCodeElement) {
    return null;
  }

  const position = getActionPosition(anchorElem, activeCodeElement);
  const style: CSSProperties = {
    position: "absolute",
    top: position.top,
    left: position.left,
  };

  return createPortal(
    <div className="code-block-actions" style={style}>
      <Tooltip content={isCopied ? "Copied" : "Copy code"}>
        <IconButton
          aria-label={isCopied ? "Copied" : "Copy code"}
          variant="surface"
          size="xs"
          onClick={async () => {
            const code = activeCodeElement.textContent ?? "";
            try {
              await navigator.clipboard.writeText(code);
              setIsCopied(true);
              if (copyResetTimeoutRef.current !== null) {
                window.clearTimeout(copyResetTimeoutRef.current);
              }
              copyResetTimeoutRef.current = window.setTimeout(() => {
                setIsCopied(false);
              }, 1200);
            } catch {
              setIsCopied(false);
            }
          }}
        >
          {isCopied ? <Check size={14} /> : <Copy size={14} />}
        </IconButton>
      </Tooltip>
    </div>,
    anchorElem,
  );
}
