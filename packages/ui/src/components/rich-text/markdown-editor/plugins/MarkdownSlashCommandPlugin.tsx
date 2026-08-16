import { Box, Button, Dialog, Field, Flex, Icon, Input, Text } from "@chakra-ui/react";
import { $createCodeNode } from "@lexical/code";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { LexicalTypeaheadMenuPlugin, type MenuTextMatch } from "@lexical/react/LexicalTypeaheadMenuPlugin";
import {
  $addUpdateTag,
  $createParagraphNode,
  $getNodeByKey,
  $isParagraphNode,
  $isTextNode,
  HISTORY_MERGE_TAG,
  type LexicalNode,
  type TextNode,
} from "lexical";
import { Code2, Image as ImageIcon, Minus, Table2 } from "lucide-react";
import { type ElementType, type FormEvent, useEffect, useState } from "react";
import * as ReactDOM from "react-dom";
import { createEmptyMarkdownTable } from "../../shared/markdown-table";
import { $createDataTableNode } from "../../shared/nodes/DataTableNode";
import { $createMarkdownImageNode } from "../../shared/nodes/MarkdownImageNode";

interface SlashCommandOption {
  id: "table" | "image" | "code" | "divider";
  key: string;
  label: string;
  icon: ElementType;
  setRefElement: (element: HTMLElement | null) => void;
}

const commandDefinitions: Array<Omit<SlashCommandOption, "key" | "setRefElement">> = [
  { id: "table", label: "Table", icon: Table2 },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "code", label: "Code block", icon: Code2 },
  { id: "divider", label: "Divider", icon: Minus },
];

const slashTrigger = (text: string): MenuTextMatch | null => {
  const match = /^\/([a-z ]*)$/i.exec(text);
  if (!match) return null;

  return {
    leadOffset: 0,
    matchingString: match[1] ?? "",
    replaceableString: match[0],
  };
};

const createTableId = () => {
  const unique = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `table-${unique}`;
};

const replaceSlashWithBlock = (queryNode: TextNode | null, block: LexicalNode) => {
  const parent = queryNode?.getParent();
  if (!$isParagraphNode(parent)) return;

  parent.replace(block);
  const nextParagraph = $createParagraphNode();
  block.insertAfter(nextParagraph);
  nextParagraph.select();
};

interface SlashCommandMenuProps {
  options: SlashCommandOption[];
  selectedIndex: number | null;
  onSelect: (option: SlashCommandOption, index: number) => void;
  onHighlight: (index: number) => void;
}

const SlashCommandMenu = (props: SlashCommandMenuProps) => {
  const { options, selectedIndex, onSelect, onHighlight } = props;

  useEffect(() => {
    document.getElementById(`slash-command-${selectedIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <Box
      role="listbox"
      aria-label="Insert content"
      position="absolute"
      zIndex="popover"
      layerStyle="modal"
      minWidth="13rem"
      overflow="hidden"
      paddingY="2xs"
    >
      <Text paddingX="sm" paddingY="2xs" color="fg.muted" textStyle="label/S/medium">
        Insert
      </Text>
      {options.length === 0 ? (
        <Text padding="sm" color="fg.muted" textStyle="paragraph/S/regular">
          No matching commands
        </Text>
      ) : null}
      {options.map((option, index) => {
        const selected = selectedIndex === index;
        return (
          <Flex
            key={option.id}
            ref={option.setRefElement}
            id={`slash-command-${index}`}
            role="option"
            aria-selected={selected}
            alignItems="center"
            gap="xs"
            paddingX="sm"
            paddingY="xs"
            cursor="pointer"
            background={selected ? "bg.active" : "transparent"}
            _hover={{ background: selected ? "bg.active" : "bg.hover" }}
            onMouseEnter={() => onHighlight(index)}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onSelect(option, index)}
          >
            <Icon as={option.icon} boxSize="16px" flexShrink={0} />
            <Text minWidth="0" truncate textStyle="label/M/medium">
              {option.label}
            </Text>
          </Flex>
        );
      })}
    </Box>
  );
};

export const MarkdownSlashCommandPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const [imageQueryNodeKey, setImageQueryNodeKey] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("Image");
  const options = commandDefinitions
    .filter((option) => !query || option.label.toLowerCase().includes(query.toLowerCase()))
    .map((option) => ({ ...option, key: option.id, setRefElement: () => {} }));

  const closeImageDialog = () => {
    if (imageQueryNodeKey) {
      editor.update(
        () => {
          const queryNode = $getNodeByKey(imageQueryNodeKey);
          if ($isTextNode(queryNode)) {
            const parent = queryNode.getParent();
            queryNode.remove();
            parent?.selectEnd();
          }
        },
        { tag: HISTORY_MERGE_TAG },
      );
    }

    setImageQueryNodeKey(null);
    setTimeout(() => editor.focus(), 0);
  };

  const insertImage = (event: FormEvent) => {
    event.preventDefault();
    if (!imageQueryNodeKey || !imageUrl.trim()) return;

    editor.update(
      () => {
        const queryNode = $getNodeByKey(imageQueryNodeKey);
        if ($isTextNode(queryNode)) {
          const imageNode = $createMarkdownImageNode(imageUrl.trim(), imageAlt.trim() || "Image");
          const parent = queryNode.getParent();
          queryNode.replace(imageNode);
          if ($isParagraphNode(parent)) {
            const nextParagraph = $createParagraphNode();
            parent.insertAfter(nextParagraph);
            nextParagraph.select();
          }
        }
      },
      { tag: HISTORY_MERGE_TAG },
    );
    setImageQueryNodeKey(null);
    setTimeout(() => editor.focus(), 0);
  };

  return (
    <>
      <LexicalTypeaheadMenuPlugin<SlashCommandOption>
        onQueryChange={setQuery}
        triggerFn={slashTrigger}
        options={options}
        onSelectOption={(option, queryNode, closeMenu) => {
          if (option.id === "image") {
            setImageUrl("");
            setImageAlt("Image");
            setImageQueryNodeKey(queryNode?.getKey() ?? null);
            closeMenu();
            return;
          }

          $addUpdateTag(HISTORY_MERGE_TAG);
          if (option.id === "table") {
            replaceSlashWithBlock(queryNode, $createDataTableNode(createEmptyMarkdownTable(createTableId())));
          }
          if (option.id === "code") replaceSlashWithBlock(queryNode, $createCodeNode());
          if (option.id === "divider") replaceSlashWithBlock(queryNode, $createHorizontalRuleNode());
          closeMenu();
        }}
        menuRenderFn={(anchorElementRef, menu) => {
          if (!anchorElementRef.current) return null;
          return ReactDOM.createPortal(
            <SlashCommandMenu
              options={menu.options}
              selectedIndex={menu.selectedIndex}
              onHighlight={menu.setHighlightedIndex}
              onSelect={(option, index) => {
                menu.setHighlightedIndex(index);
                menu.selectOptionAndCleanUp(option);
              }}
            />,
            anchorElementRef.current,
          );
        }}
      />
      <Dialog.Root
        open={Boolean(imageQueryNodeKey)}
        finalFocusEl={() => editor.getRootElement()}
        onOpenChange={(details) => {
          if (!details.open && imageQueryNodeKey) closeImageDialog();
        }}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content asChild>
            <form onSubmit={insertImage}>
              <Dialog.Header>
                <Dialog.Title>Insert image</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Flex direction="column" gap="sm">
                  <Field.Root required>
                    <Field.Label>Image URL</Field.Label>
                    <Input autoFocus value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Alt text</Field.Label>
                    <Input value={imageAlt} onChange={(event) => setImageAlt(event.target.value)} />
                  </Field.Root>
                </Flex>
              </Dialog.Body>
              <Dialog.Footer>
                <Button type="button" variant="ghost" onClick={closeImageDialog}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={!imageUrl.trim()}>
                  Insert image
                </Button>
              </Dialog.Footer>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
};
