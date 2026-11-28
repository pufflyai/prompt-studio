import { Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { Activity, AlertMessage } from "@pstdio/ui";
import { X } from "lucide-react";
import { useRef, useState } from "react";
import type { WorkbenchCore } from "../../core";
import type { ResourceActivityBinding } from "../../core/registries/resources/resource-activity";
import { peekResourceActivityDraft } from "./resource-activity-drafts";
import { useResourceActivityComposer } from "./use-resource-activity-composer";

export const ResourceActivityComposer = (props: {
  controller: ReturnType<typeof useResourceActivityComposer>;
  reply?: boolean;
  autoFocus?: boolean;
  onEditorFocus?(): void;
  onIdle?(): void;
  onPosted?(): void;
}) => {
  const { controller, reply = false, autoFocus, onEditorFocus, onIdle, onPosted } = props;
  const { draft, busy } = controller;
  const upload = useRef<HTMLInputElement>(null);
  return (
    <Stack
      gap="xs"
      onFocus={onEditorFocus}
      onBlur={(event) => {
        if (
          !onIdle ||
          !event.relatedTarget ||
          event.currentTarget.contains(event.relatedTarget) ||
          busy ||
          controller.error ||
          draft.body ||
          draft.attachments.length
        )
          return;
        // Markdown publication can trail typing; never collapse an input with unsaved DOM text.
        if (!event.currentTarget.querySelector('[role="textbox"]')?.textContent?.trim()) onIdle();
      }}
    >
      <Activity.Composer
        autoFocus={autoFocus}
        variant={reply ? "inline" : "compact"}
        value={draft.body}
        placeholder={reply ? "Leave a reply…" : "Leave a comment…"}
        submitLabel={reply ? "Submit reply" : "Submit comment"}
        disabled={busy}
        hasAttachments={draft.attachments.length > 0}
        onChange={(body) => controller.changeDraft({ ...draft, body, key: crypto.randomUUID() })}
        onSubmit={() => {
          if (!busy)
            void controller.publish().then((entry) => {
              if (entry) onPosted?.();
            });
        }}
        onAttach={() => upload.current?.click()}
        attachmentList={
          (controller.uploading || draft.attachments.length > 0) && (
            <Stack gap="xs">
              {controller.uploading && (
                <Text role="status" color="fg.muted" textStyle="label/S/regular">
                  Uploading {controller.uploading}…
                </Text>
              )}
              {draft.attachments.length > 0 && (
                <HStack gap="xs" flexWrap="wrap" aria-label={reply ? "Reply attachments" : "Comment attachments"}>
                  {draft.attachments.map((file) => (
                    <HStack key={file.id} gap="2xs" minW="0" maxW="full">
                      <Text textStyle="label/S/regular" truncate title={file.name}>
                        {file.name}
                      </Text>
                      <IconButton
                        size="2xs"
                        variant="ghost"
                        aria-label={`Remove ${file.name}`}
                        disabled={busy}
                        onClick={() =>
                          controller.changeDraft({
                            ...draft,
                            attachments: draft.attachments.filter((item) => item.id !== file.id),
                            key: crypto.randomUUID(),
                          })
                        }
                      >
                        <X />
                      </IconButton>
                    </HStack>
                  ))}
                </HStack>
              )}
            </Stack>
          )
        }
      />
      {reply && controller.error && (
        <AlertMessage role="alert" status="error" title="Could not save reply" onClose={controller.clearError}>
          {controller.error}
        </AlertMessage>
      )}
      <input
        hidden
        multiple
        type="file"
        disabled={busy}
        ref={upload}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          void controller.attach(files);
        }}
      />
    </Stack>
  );
};

interface ResourceActivityReplyComposerProps {
  workbench: WorkbenchCore;
  binding: ResourceActivityBinding;
  resource: ResourceRef;
  replyToId: string;
  onPublished(): Promise<unknown>;
}

const hasReplyDraft = (props: ResourceActivityReplyComposerProps) => {
  const store = peekResourceActivityDraft(props.workbench, resourceKey(props.resource), props.replyToId);
  const draft = store?.get();
  return Boolean(draft?.body || draft?.attachments.length || store?.busy() || store?.error());
};

const ActiveReplyComposer = (
  props: ResourceActivityReplyComposerProps & {
    autoFocus: boolean;
    onEditorFocus(): void;
    onIdle(): void;
    onPosted(): void;
  },
) => {
  const { workbench, binding, resource, replyToId, onPublished } = props;
  const composer = useResourceActivityComposer(workbench, binding, resource, { replyToId, onPublished });
  return (
    <ResourceActivityComposer
      controller={composer}
      reply
      autoFocus={props.autoFocus}
      onEditorFocus={props.onEditorFocus}
      onIdle={props.onIdle}
      onPosted={props.onPosted}
    />
  );
};

export const ResourceActivityReplyComposer = (props: ResourceActivityReplyComposerProps) => {
  const [editor, setEditor] = useState(() => ({ active: hasReplyDraft(props), autoFocus: false }));
  if (!editor.active) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        w="full"
        justifyContent="start"
        borderRadius="0"
        color="fg.muted"
        onClick={() => setEditor({ active: true, autoFocus: true })}
      >
        {hasReplyDraft(props) ? "Continue reply…" : "Leave a reply…"}
      </Button>
    );
  }
  return (
    <ActiveReplyComposer
      {...props}
      autoFocus={editor.autoFocus}
      onEditorFocus={() => {
        if (editor.autoFocus) setEditor({ active: true, autoFocus: false });
      }}
      onIdle={() => setEditor({ active: false, autoFocus: false })}
      onPosted={() => setEditor({ active: hasReplyDraft(props), autoFocus: false })}
    />
  );
};
