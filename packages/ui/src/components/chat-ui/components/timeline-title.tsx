import { Avatar, Link, Span } from "@chakra-ui/react";
import type { MouseEvent } from "react";
import { DiffBubble } from "@/components/diff-viewer/diff-bubble";
import { Tooltip } from "@/components/primitives/tooltip";
import type { TitleSegment } from "./timeline";

const handleTitleLinkClick = (
  event: MouseEvent<HTMLAnchorElement>,
  seg: Extract<TitleSegment, { kind: "link" }>,
  onOpenFile?: (filePath: string) => void,
  stopPropagation = false,
) => {
  if (stopPropagation) {
    event.stopPropagation();
  }

  if (!seg.href) {
    event.preventDefault();
  }
  if (seg.filePath) {
    onOpenFile?.(seg.filePath);
  }
};

function AvatarTitleSegment({ seg }: { seg: Extract<TitleSegment, { kind: "avatar" }> }) {
  return (
    <Avatar.Root width="1.5rem" height="1.5rem">
      <Avatar.Image src={seg.src} alt={seg.alt} />
      <Avatar.Fallback background="bg.muted" color="fg.muted" />
    </Avatar.Root>
  );
}

function DiffTitleSegment({
  seg,
  onOpenFile,
}: {
  seg: Extract<TitleSegment, { kind: "diff" }>;
  onOpenFile?: (filePath: string) => void;
}) {
  return (
    <DiffBubble
      fileName={seg.fileName}
      additions={seg.additions ?? 0}
      deletions={seg.deletions ?? 0}
      onClickFileLink={() => {
        const path = seg.filePath ?? seg.fileName;
        onOpenFile?.(path);
      }}
    />
  );
}

function BubbleLinkTitleSegment({
  seg,
  onOpenFile,
}: {
  seg: Extract<TitleSegment, { kind: "link" }>;
  onOpenFile?: (filePath: string) => void;
}) {
  const fontWeight = seg.bold ? "medium" : undefined;
  const isInteractive = Boolean(seg.href || seg.filePath);

  return (
    <Link
      href={seg.href ?? "#"}
      fontWeight={fontWeight}
      color={seg.muted ? "fg.muted" : "fg.muted"}
      textDecoration="none"
      cursor={isInteractive ? "pointer" : "default"}
      onClick={(event) => handleTitleLinkClick(event, seg, onOpenFile, true)}
      _hover={{
        textDecoration: "underline",
        color: seg.muted ? "fg.muted" : "fg.blue-dark",
      }}
    >
      {seg.text}
    </Link>
  );
}

function DefaultLinkTitleSegment({
  seg,
  onOpenFile,
}: {
  seg: Extract<TitleSegment, { kind: "link" }>;
  onOpenFile?: (filePath: string) => void;
}) {
  const fontWeight = seg.bold ? "medium" : undefined;

  return (
    <Link
      href={seg.href ?? "#"}
      fontWeight={fontWeight}
      color={seg.muted ? "fg.muted" : "accent.primary"}
      textDecoration="underline"
      onClick={(event) => handleTitleLinkClick(event, seg, onOpenFile)}
      _hover={{
        color: seg.muted ? "fg.muted" : "accent.primary",
        textDecoration: "underline",
      }}
    >
      {seg.text}
    </Link>
  );
}

function TextTitleSegment({
  seg,
  isClickable,
}: {
  seg: Extract<TitleSegment, { kind: "text" }>;
  isClickable?: boolean;
}) {
  const segment = (
    <Span
      fontWeight={seg.bold ? "medium" : undefined}
      textStyle={seg.monospace ? "mono/XS" : undefined}
      color="fg.muted"
      minW={seg.truncate ? "0" : undefined}
      overflow={seg.truncate ? "hidden" : undefined}
      textOverflow={seg.truncate ? "ellipsis" : undefined}
      whiteSpace={seg.truncate ? "nowrap" : undefined}
      _groupHover={{
        color: isClickable && !seg.muted ? "fg" : "fg.muted",
      }}
    >
      {seg.text}
    </Span>
  );

  if (!seg.truncate) return segment;

  return <Tooltip content={seg.text}>{segment}</Tooltip>;
}

export function TitleInline({
  seg,
  isClickable,
  onOpenFile,
}: {
  seg: TitleSegment;
  isClickable?: boolean;
  onOpenFile?: (filePath: string) => void;
}) {
  switch (seg.kind) {
    case "avatar":
      return <AvatarTitleSegment seg={seg} />;
    case "diff":
      return <DiffTitleSegment seg={seg} onOpenFile={onOpenFile} />;
    case "link":
      return seg.variant === "bubble" ? (
        <BubbleLinkTitleSegment seg={seg} onOpenFile={onOpenFile} />
      ) : (
        <DefaultLinkTitleSegment seg={seg} onOpenFile={onOpenFile} />
      );
    case "text":
      return <TextTitleSegment seg={seg} isClickable={isClickable} />;
    default:
      return null;
  }
}
