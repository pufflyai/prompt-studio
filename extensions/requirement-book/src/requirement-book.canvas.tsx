import "@pstdio/ui/style.css";
import { Stack } from "@chakra-ui/react";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { useState } from "react";
import { BookBrowser } from "./book-browser";
import type { Rule } from "./model";
import { bookFixture } from "./model.fixture";

export default { title: "Extensions/Requirement book", fullscreen: true };
export function Documentation() {
  const book = bookFixture();
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
          observations={[]}
          onSelect={setSelected}
          onOpen={setSelected}
          onCreate={() => setEditor({ ...book.rules[0], title: "New rule" })}
          onEdit={setEditor}
          onMove={() => {}}
          onRemove={() => {}}
          onSave={() => setEditor(null)}
          onCancel={() => setEditor(null)}
          onMapObservation={() => {}}
        />
      </Stack>
    </ChakraProvider>
  );
}
