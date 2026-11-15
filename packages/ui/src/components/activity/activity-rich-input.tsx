import { useState } from "react";
import { LazyMarkdownEditor } from "../rich-text/lazy-markdown-editor";

interface ActivityRichInputProps {
  value: string;
  disabled: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}

export const ActivityRichInput = ({ value, disabled, placeholder, onChange }: ActivityRichInputProps) => {
  const [editor, setEditor] = useState({ value, key: 0 });
  // Preserve selection while the parent echoes edits; remount only for external
  // draft replacement (for example, clearing a successfully submitted comment).
  if (value !== editor.value) setEditor({ value, key: editor.key + 1 });
  return (
    <LazyMarkdownEditor
      ariaLabel={placeholder}
      key={editor.key}
      defaultState={value}
      isEditable={!disabled}
      fullWidth
      scrollable={false}
      padding="0"
      placeholder={placeholder}
      onChange={(next) => {
        setEditor({ ...editor, value: next });
        onChange(next);
      }}
    />
  );
};
