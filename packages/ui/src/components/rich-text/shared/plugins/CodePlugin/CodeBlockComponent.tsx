import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { $getNodeByKey } from "lexical";
import { AlertCircle, Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Tooltip } from "../../../../tooltip";
import { DefaultRichTextCodeEditor } from "../../components/default-rich-text-components";
import { $isCodeBlockNode } from "./CodeNode";
import { consumeCodeBlockFocus } from "./code-block-focus";

interface CodeBlockComponentProps {
  code: string;
  language: string;
  nodeKey: string;
}

export function CodeBlockComponent(props: CodeBlockComponentProps) {
  const { code, language, nodeKey } = props;
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const [draftCode, setDraftCode] = useState(code);
  const [copyFeedback, setCopyFeedback] = useState<"copied" | "error" | "idle">("idle");

  useEffect(() => {
    setDraftCode(code);
  }, [code]);

  useEffect(() => {
    if (!isEditable || !consumeCodeBlockFocus(nodeKey)) {
      return;
    }

    textareaRef.current?.focus();
    const nextValue = textareaRef.current?.value ?? "";
    textareaRef.current?.setSelectionRange(nextValue.length, nextValue.length);
  }, [isEditable, nodeKey]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleCodeChange = (value: string) => {
    setDraftCode(value);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isCodeBlockNode(node)) {
        node.setCode(value);
      }
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftCode);
      setCopyFeedback("copied");

      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }

      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        setCopyFeedback("idle");
      }, 1500);
    } catch {
      setCopyFeedback("error");

      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }

      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        setCopyFeedback("idle");
      }, 1500);
    }
  };

  return (
    <Box borderRadius="md" overflow="hidden" borderWidth="1px" borderColor="border.muted">
      <Flex alignItems="center" justifyContent="space-between" paddingX="sm" paddingY="xs" bg="bg.muted">
        <Text textStyle="label/S/medium" color="fg.muted">
          {language || "plaintext"}
        </Text>

        <Tooltip
          content={copyFeedback === "copied" ? "Copied" : copyFeedback === "error" ? "Copy failed" : "Copy code"}
        >
          <Button size="xs" variant="surface" onClick={() => void handleCopy()}>
            {copyFeedback === "copied" ? (
              <Check size={14} />
            ) : copyFeedback === "error" ? (
              <AlertCircle size={14} />
            ) : (
              <Copy size={14} />
            )}
            {copyFeedback === "copied" ? "Copied" : copyFeedback === "error" ? "Failed" : "Copy"}
          </Button>
        </Tooltip>
      </Flex>

      <DefaultRichTextCodeEditor
        language={language}
        defaultCode={draftCode}
        isEditable={isEditable}
        onChange={handleCodeChange}
        showLineNumbers={!isEditable}
        disableScroll
        textareaRef={textareaRef}
      />
    </Box>
  );
}
