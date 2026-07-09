import { Flex, Kbd, Text } from "@chakra-ui/react";
import { MarkNode } from "@lexical/mark";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { $getRoot } from "lexical";
import type { ReactElement } from "react";
import { type ForwardRefRenderFunction, forwardRef, useRef } from "react";
import { ContentEditable } from "../shared/components/content-editable";
import ToggleEditablePlugin from "../shared/plugins/ToggleEditablePlugin";
import { TreeViewPlugin } from "../shared/plugins/TreeViewPlugin/TreeViewPlugin";
import { CommentPlugin } from "./plugins/CommentPlugin/CommentPlugin";
import { CommentNode } from "./plugins/CommentPlugin/nodes/CommentNode/CommentNode";
import { ImperativeAPIPlugin, type PromptEditorRef } from "./plugins/ImperativeAPIPlugin";
import { KeyboardShortcutPlugin } from "./plugins/KeyboardShortcutPlugin";
import { ReferenceMenuPlugin } from "./plugins/ReferenceMenuPlugin/ReferenceMenuPlugin";
import { ReferenceNode } from "./plugins/ReferencePlugin/nodes/ReferenceNode/ReferenceNode";
import { ReferencePlugin } from "./plugins/ReferencePlugin/ReferencePlugin";
import theme from "./theme/prompt-input-theme";
import { $getTextContent, getTextFromSerializedEditorState } from "./utils";

export type ReferenceResourceType = "table" | "connector" | "file";

export type ReferenceItem = {
  resourceId: string;
  resourceType: ReferenceResourceType;
  name: string;
  description?: string;
};

export interface PromptEditorProps {
  defaultState: string;
  debug?: boolean;
  isEditable?: boolean;
  placeholder?: ReactElement | ((isEditable: boolean) => ReactElement | null);
  onChange?: (text: string, state: object) => void;
  onError?: (error: Error) => void;
  onSubmit?: () => void;
  /** Dynamic list of references (tables, connectors) shown when typing # */
  references?: ReferenceItem[];
  /** Optional app callback when a reference is inserted */
  onAddReference?: (resourceId: string, resourceType: ReferenceResourceType) => void;
}

const nodes = [CommentNode, MarkNode, ReferenceNode];

export const BasePromptEditor: ForwardRefRenderFunction<PromptEditorRef, PromptEditorProps> = (props, ref) => {
  const { defaultState, debug = false, isEditable = true, placeholder } = props;
  const { onChange, onError = () => {}, onSubmit, references = [], onAddReference } = props;

  const initialConfig = {
    namespace: "PROMPT_EDITOR",
    nodes,
    editorState: defaultState,
    editable: isEditable,
    onError,
    theme,
  };

  const previousTextRef = useRef<string>(getTextFromSerializedEditorState(defaultState));
  const placeholderNode: ReactElement | ((isEditable: boolean) => ReactElement | null) = placeholder ?? (
    <Text textStyle="label/M/regular" color="fg.subtle" pointerEvents="none" position="absolute" top="0">
      Type your query here or press <Kbd color="fg.subtle">#</Kbd> to add a reference.
    </Text>
  );

  return (
    <Flex direction="column" justifyContent="space-between" width="100%" position="relative">
      <LexicalComposer initialConfig={initialConfig}>
        <HistoryPlugin />
        <RichTextPlugin
          contentEditable={<ContentEditable fullWidth />}
          placeholder={placeholderNode}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <OnChangePlugin
          ignoreSelectionChange
          ignoreHistoryMergeTagChange={false}
          onChange={(editorState) => {
            editorState.read(() => {
              // handle comment blocks properly
              const root = $getRoot();
              const rawText = $getTextContent(root);

              if (rawText !== previousTextRef.current) {
                previousTextRef.current = rawText;
                onChange?.(rawText, editorState.toJSON());
              }
            });
          }}
        />
        <ImperativeAPIPlugin editorRef={ref} previousTextRef={previousTextRef} />
        <ToggleEditablePlugin isEditable={isEditable} />
        <CommentPlugin />
        <KeyboardShortcutPlugin onSubmit={onSubmit} />
        <ReferenceMenuPlugin items={references} />
        <ReferencePlugin onAddReference={onAddReference} />
        {debug ? <TreeViewPlugin /> : ""}
      </LexicalComposer>
    </Flex>
  );
};

export const PromptEditor = forwardRef(BasePromptEditor);

export type { PromptEditorRef } from "./plugins/ImperativeAPIPlugin";
