import { Stack } from "@chakra-ui/react";
import { Activity, AlertMessage } from "@pstdio/ui";
import type { MarkdownEditorSelection } from "@pstdio/ui/rich-text";
import { useRef, useState } from "react";
import type { useMarkdownActivity } from "./markdown-activity";

export interface PassageCommentDraft {
  selection: MarkdownEditorSelection;
  body: string;
  key: string;
}
export const MarkdownCommentComposer = (props: {
  draft: PassageCommentDraft;
  busy: boolean;
  onBusyChange(busy: boolean): void;
  onChange(draft: PassageCommentDraft): void;
  onPosted(): void;
  publish: NonNullable<ReturnType<typeof useMarkdownActivity>>["publish"];
}) => {
  const { draft, busy, onBusyChange, onChange, onPosted, publish } = props;
  const pending = useRef(false);
  const [error, setError] = useState<string>();
  const submit = async () => {
    if (pending.current || !draft.body.trim() || !draft.selection.anchor) return;
    pending.current = true;
    onBusyChange(true);
    setError(undefined);
    try {
      await publish({ body: draft.body, key: draft.key, quote: draft.selection.text, anchor: draft.selection.anchor });
      onPosted();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      pending.current = false;
      onBusyChange(false);
    }
  };
  return (
    <Stack gap="xs">
      <Activity.Composer
        autoFocus
        variant="compact"
        placeholder="Write a comment…"
        value={draft.body}
        disabled={busy}
        onChange={(body) => onChange({ ...draft, body, key: crypto.randomUUID() })}
        onSubmit={() => void submit()}
      />
      {error && (
        <AlertMessage status="error" title="Could not post comment">
          {error}
        </AlertMessage>
      )}
    </Stack>
  );
};
