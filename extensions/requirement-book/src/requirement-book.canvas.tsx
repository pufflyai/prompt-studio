import "@pstdio/ui/style.css";
import { Icon, Stack } from "@chakra-ui/react";
import { ChakraProvider, psTheme, ResourceBadge, resolveIconComponent } from "@pstdio/ui";
import { useState } from "react";
import { BookBrowser } from "./book-browser";
import { BookFinding } from "./book-findings";
import { type Chapter, chapterReference, type Rule } from "./model";
import { bookFixture } from "./model.fixture";
import { resourceSpecs } from "./resource-catalog";

export default { title: "Extensions/Requirement book", fullscreen: true };
export function Documentation() {
  const book = bookFixture();
  book.rules[0] = {
    ...book.rules[0],
    title:
      "Preserve user work when a very long requirement title needs to fit within a narrow rule tree without widening the panel",
    acceptance: [
      { statement: "Saved work remains accessible after reopening the project.", tests: [] },
      { statement: "An interrupted save preserves the previous complete version.", tests: [] },
    ],
  };
  book.rules = book.rules.map((rule) => ({ ...rule, section: "" }));
  const [selected, setSelected] = useState(book.rules[0].ref);
  const [editor, setEditor] = useState<Rule | null>(null);
  return (
    <ChakraProvider value={psTheme}>
      <Stack h="100dvh" minH="0" bg="bg" color="fg">
        <BookBrowser
          rules={book.rules}
          chapters={book.chapters}
          chapter={1}
          selected={selected}
          editor={editor}
          onSelect={setSelected}
          onOpen={setSelected}
          onEdit={setEditor}
          onMove={() => {}}
          onRemove={() => {}}
          onSave={() => setEditor(null)}
          onCancel={() => setEditor(null)}
        />
      </Stack>
    </ChakraProvider>
  );
}

export function Resources() {
  const chapters: Chapter[] = [
    { id: 1, title: "Workspaces", group: "Core" },
    { id: 16, title: "Planner", group: "Extensions" },
  ];
  return (
    <ChakraProvider value={psTheme}>
      <Stack p="lg" gap="md">
        {chapters.map((chapter) => (
          <ResourceBadge
            key={chapter.id}
            fileName={`${chapterReference(chapter)} ${chapter.title}`}
            icon={<Icon as={resolveIconComponent("library")} />}
          />
        ))}
        {resourceSpecs.map((spec) => (
          <ResourceBadge key={spec.id} fileName={spec.label} icon={<Icon as={resolveIconComponent(spec.icon)} />} />
        ))}
      </Stack>
    </ChakraProvider>
  );
}

export function ResolvedFinding() {
  return (
    <ChakraProvider value={psTheme}>
      <BookFinding
        finding={{
          id: "example",
          workspaceId: "sample",
          kind: "potential-conflict",
          title: "Reviewed terminology",
          explanation: "The naming difference was reconciled.",
          requirements: [],
          resolved: true,
          updatedAt: "2026-11-06",
          unread: false,
        }}
        onRead={() => {}}
        onOpen={() => {}}
        onResolve={() => {}}
      />
    </ChakraProvider>
  );
}
