import { Button, CloseButton, HStack, Input, Text } from "@chakra-ui/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect, useRef, useState } from "react";
import { findMarkdownRanges, paintMarkdownRanges, revealMarkdownRange } from "./markdown-find-ranges";

export const MarkdownFindPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Range[]>([]);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const find = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(true);
        input.current?.focus();
        input.current?.select();
      }
    };
    return editor.registerRootListener((root, previous) => {
      previous?.removeEventListener("keydown", find);
      root?.addEventListener("keydown", find);
    });
  }, [editor]);

  useEffect(() => {
    if (!open) return;
    const refresh = () => {
      const root = editor.getRootElement();
      setMatches(root ? findMarkdownRanges(root, query) : []);
    };
    refresh();
    return editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size || dirtyLeaves.size) refresh();
    });
  }, [editor, open, query]);

  const activeIndex = matches.length ? Math.min(index, matches.length - 1) : 0;
  useEffect(() => {
    if (open) return paintMarkdownRanges("markdown-find", matches);
  }, [matches, open]);
  useEffect(() => {
    const range = matches[activeIndex];
    if (!open || !range) return;
    revealMarkdownRange(range);
    return paintMarkdownRanges("markdown-find-active", [range], 1);
  }, [activeIndex, matches, open]);

  const move = (direction: number) => {
    if (matches.length) setIndex((activeIndex + direction + matches.length) % matches.length);
  };
  const close = () => {
    setOpen(false);
    editor.getRootElement()?.focus({ preventScroll: true });
  };
  if (!open) return null;
  const summary = matches.length ? `${activeIndex + 1} of ${matches.length}` : "No matches";

  return (
    <HStack
      role="search"
      aria-label="Find in document"
      gap="xs"
      p="xs"
      flexShrink={0}
      borderBottomWidth="1px"
      borderColor="border.subtle"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <Input
        ref={input}
        autoFocus
        size="sm"
        aria-label="Find in document"
        placeholder="Find in document"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            move(event.shiftKey ? -1 : 1);
          }
        }}
      />
      <Text role="status" textStyle="label/S/regular" whiteSpace="nowrap">
        {query ? summary : ""}
      </Text>
      <Button size="xs" variant="ghost" onClick={() => move(-1)} disabled={matches.length === 0}>
        Previous
      </Button>
      <Button size="xs" variant="ghost" onClick={() => move(1)} disabled={matches.length === 0}>
        Next
      </Button>
      <CloseButton size="sm" aria-label="Close Find" onClick={close} />
    </HStack>
  );
};
