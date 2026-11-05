import { Button, Flex } from "@chakra-ui/react";
import type { ChatAttachment } from "@pstdio/sdk/extensions";

export const NativeChatAttachmentActions = (props: { disabled: boolean; upload(files: File[]): void }) => (
  <Button
    size="xs"
    variant="ghost"
    disabled={props.disabled}
    onClick={() => {
      const picker = document.createElement("input");
      picker.type = "file";
      picker.multiple = true;
      picker.onchange = () => props.upload(Array.from(picker.files ?? []));
      picker.click();
    }}
  >
    Attach files
  </Button>
);

export const NativeChatAttachmentList = (props: {
  attachments: ChatAttachment[];
  disabled: boolean;
  remove(id: string): void;
}) => (
  <Flex gap="xs" wrap="wrap">
    {props.attachments.map((attachment) => (
      <Button
        key={attachment.id}
        size="xs"
        variant="ghost"
        disabled={props.disabled}
        onClick={() => props.remove(attachment.id)}
        aria-label={`Remove ${attachment.name}`}
      >
        {attachment.name}
      </Button>
    ))}
  </Flex>
);
