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
  );
}
