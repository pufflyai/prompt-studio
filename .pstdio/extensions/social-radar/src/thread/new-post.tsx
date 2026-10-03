import { Badge, Button, HStack, Icon, Input, Separator, Spacer, Stack, Text } from "@chakra-ui/react";
import { CopyButton, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { Check, Lightbulb, Pencil, X } from "lucide-react";
import { useState } from "react";
import type { NewPost } from "../schemas";
import { type MediaRule, postLengthLimits, siteLabels } from "../sites";
import { MediaTray } from "./media-tray";
import { DraftEditor } from "./reply-idea";

interface NewPostDraftProps {
  post: NewPost;
  mediaRule: MediaRule;
  onEdit: (draft: string) => void;
  onDismiss: () => void;
  onPosted: (url: string) => void;
}
/** A new post before it is published: the draft as it would look on its site. */
export const NewPostDraft = (props: NewPostDraftProps) => {
  const { post, mediaRule, onEdit, onDismiss, onPosted } = props;
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState("");
  const limit = postLengthLimits[post.site];
  return (
    <Stack gap="md">
      <Text textStyle="label/S/regular" color="fg.muted">
        Draft for {siteLabels[post.site]}
      </Text>
      <SimpleCard aria-label="Draft post">
        <SimpleCardBody>
          <Stack gap="sm">
            <HStack gap="xs">
              <Icon as={Lightbulb} boxSize="icon-xs" />
              <Badge size="sm" colorPalette="purple">
                Draft post
              </Badge>
              <Spacer />
              {limit ? (
                <Text textStyle="label/XS" color={post.draft.length > limit ? "fg.error" : "fg.muted"}>
                  {post.draft.length} / {limit}
                </Text>
              ) : null}
            </HStack>
            {editing ? (
              <DraftEditor
                text={post.draft}
                onCancel={() => setEditing(false)}
                onSave={(draft) => {
                  onEdit(draft);
                  setEditing(false);
                }}
              />
            ) : (
              <Text textStyle="paragraph/M/regular" whiteSpace="pre-wrap">
                {post.draft}
              </Text>
            )}
            <MediaTray threadId={post.id} site={post.site} rule={mediaRule} />
            {editing ? null : (
              <HStack gap="2xs">
                <CopyButton size="xs" variant="ghost" text={post.draft} label="Copy post" />
                <Button size="xs" variant="ghost" onClick={() => setEditing(true)}>
                  <Pencil />
                  Edit
                </Button>
                <Spacer />
                <Button size="xs" variant="ghost" onClick={onDismiss}>
                  <X />
                  Dismiss
                </Button>
              </HStack>
            )}
          </Stack>
        </SimpleCardBody>
      </SimpleCard>
      <Separator />
      <Text textStyle="label/S/medium">Replies · none yet</Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        After you post it, paste its link and choose Mark posted. The thread moves to Answered, and follow-up runs save
        its replies here.
      </Text>
      <HStack gap="sm">
        <Input
          aria-label="Post link"
          placeholder="https://"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <Button variant="outline" disabled={!url.trim()} onClick={() => onPosted(url.trim())}>
          <Check />
          Mark posted
        </Button>
      </HStack>
    </Stack>
  );
};
