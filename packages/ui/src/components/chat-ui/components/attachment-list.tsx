import { Stack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Fragment } from "react";
import type { ResourceBadgeProps } from "@/components/primitives/resource-badge";
import { ResourceBadge } from "@/components/primitives/resource-badge";

export type AttachmentListRenderBadge = (props: AttachmentListItemRenderProps) => ReactNode;

export interface AttachmentListItemRenderProps {
  attachmentId: string;
  onSelect?: () => void;
  onRemove?: () => void;
  size: ResourceBadgeProps["size"];
  tone: ResourceBadgeProps["tone"];
}

export interface AttachmentListProps {
  attachments?: string[];
  onSelect?: (attachmentId: string) => void;
  onRemove?: (attachmentId: string) => void;
  renderBadge?: AttachmentListRenderBadge;
  size?: ResourceBadgeProps["size"];
  tone?: ResourceBadgeProps["tone"];
}

const DEFAULT_SIZE: NonNullable<ResourceBadgeProps["size"]> = "md";
const DEFAULT_TONE: NonNullable<ResourceBadgeProps["tone"]> = "neutral";

/**
 * Simple attachment list component that displays resource badges.
 *
 */
export const AttachmentList = (props: AttachmentListProps) => {
  const { attachments = [], onSelect, onRemove, renderBadge, size = DEFAULT_SIZE, tone = DEFAULT_TONE } = props;

  if (attachments.length === 0) return null;

  return (
    <Stack marginBottom="sm" gap="1" flexDir="row" flexWrap="wrap">
      {attachments.map((attachment) => {
        const select = onSelect ? () => onSelect(attachment) : undefined;
        const remove = onRemove ? () => onRemove(attachment) : undefined;

        if (renderBadge) {
          const rendered = renderBadge({ attachmentId: attachment, onSelect: select, onRemove: remove, size, tone });
          return <Fragment key={attachment}>{rendered}</Fragment>;
        }

        return (
          <ResourceBadge
            key={attachment}
            fileName={attachment}
            onSelect={select}
            onRemove={remove}
            size={size}
            tone={tone}
          />
        );
      })}
    </Stack>
  );
};
