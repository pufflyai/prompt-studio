import { Box, Button, Dialog, Field, Flex, Icon, Input, Text } from "@chakra-ui/react";
import { $createCodeNode } from "@lexical/code";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { LexicalTypeaheadMenuPlugin, type MenuTextMatch } from "@lexical/react/LexicalTypeaheadMenuPlugin";
import {
  $addUpdateTag,
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
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
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const anchorNode = selection.anchor.getNode();
  if (!$isParagraphNode(anchorNode.getParent()) || anchorNode.getPreviousSibling()) return null;

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
  const [imageParagraphKey, setImageParagraphKey] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("Image");
  const options = commandDefinitions
    .filter((option) => !query || option.label.toLowerCase().includes(query.toLowerCase()))
    .map((option) => ({ ...option, key: option.id, setRefElement: () => {} }));

  const closeImageDialog = () => {
    if (imageParagraphKey) {
      editor.update(
        () => {
          const paragraph = $getNodeByKey(imageParagraphKey);
          if ($isParagraphNode(paragraph)) paragraph.selectStart();
        },
        { tag: HISTORY_MERGE_TAG },
      );
    }

    setImageParagraphKey(null);
    setTimeout(() => editor.focus(), 0);
  };

  const insertImage = (event: FormEvent) => {
    event.preventDefault();
    if (!imageParagraphKey || !imageUrl.trim()) return;

    editor.update(
      () => {
        const paragraph = $getNodeByKey(imageParagraphKey);
        if ($isParagraphNode(paragraph)) {
          paragraph.splice(0, 0, [$createMarkdownImageNode(imageUrl.trim(), imageAlt.trim() || "Image")]);
          const nextParagraph = $createParagraphNode();
          paragraph.insertAfter(nextParagraph);
          nextParagraph.select();
        }
      },
      { tag: HISTORY_MERGE_TAG },
    );
    setImageParagraphKey(null);
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
            const paragraph = queryNode?.getParent();
            const selection = $getSelection();
            if (!$isParagraphNode(paragraph) || !$isRangeSelection(selection)) return;

            // Typeahead text nodes can merge after this update. Keep the paragraph
            // as the insertion position and consume the command before opening the dialog.
            $addUpdateTag(HISTORY_MERGE_TAG);
            selection.anchor.set(paragraph.getKey(), 0, "element");
            selection.removeText();
            setImageUrl("");
            setImageAlt("Image");
            setImageParagraphKey(paragraph.getKey());
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
        open={Boolean(imageParagraphKey)}
        finalFocusEl={() => editor.getRootElement()}
        onOpenChange={(details) => {
          if (!details.open && imageParagraphKey) closeImageDialog();
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
