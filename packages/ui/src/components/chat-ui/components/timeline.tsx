import {
  Avatar,
  Box,
  Button,
  Card,
  Timeline as ChakraTimeline,
  Image,
  Link,
  Span,
  Stack,
  Text,
} from "@chakra-ui/react";
import { ChevronUpIcon } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useState } from "react";
import { DiffBubble } from "@/components/diff-viewer/diff-bubble";
import { DiffEditor } from "@/components/diff-viewer/diff-editor";
import { ResourceBadge } from "@/components/primitives/resource-badge";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { Tooltip } from "@/components/primitives/tooltip";
import type { IconName } from "../utils/get-icon";
import { getIconComponent } from "../utils/get-icon";
import { QuestionFormBlockView, TodoListBlockView } from "./timeline-tool-blocks";

const Timeline = ChakraTimeline;

export type TimelineDoc = {
  items: Item[];
};

export type Item = {
  id?: string;
  timestamp?: string;
  indicator?: Indicator;
  title: TitleSegment[];
  blocks?: Block[];
  expandable?: boolean;
};

export type Indicator =
  | { type: "icon"; icon: IconName; color?: string }
  | { type: "avatar"; src: string; alt?: string }
  | { type: "none" };

export type TitleSegment =
  | {
      kind: "text";
      text: string;
      bold?: boolean;
      muted?: boolean;
      truncate?: boolean;
      monospace?: boolean;
    }
  | { kind: "avatar"; src: string; alt?: string }
  | {
      kind: "diff";
      fileName: string;
      filePath?: string;
      additions?: number;
      deletions?: number;
    }
  | {
      kind: "link";
      text: string;
      href?: string;
      filePath?: string;
      bold?: boolean;
      muted?: boolean;
      variant?: "default" | "bubble";
    };

export type TodoListBlockItem = {
  label: string;
  checked: boolean;
};

export type QuestionFormBlockOption = {
  label: string;
  description?: string;
};

export type QuestionFormBlockQuestion = {
  id?: string;
  question: string;
  options: QuestionFormBlockOption[];
  multiple: boolean;
  required: boolean;
  allowCustomAnswer: boolean;
};

export type Block =
  | { type: "comment"; text: string; reactions?: { clap?: number } }
  | { type: "code"; language: string; code: string; editable?: boolean }
  | {
      type: "diff";
      language?: string;
      original: string;
      modified: string;
      sideBySide?: boolean;
    }
  | { type: "input"; placeholder?: string }
  | { type: "text"; text: string }
  | { type: "todo-list"; items: TodoListBlockItem[] }
  | { type: "question-form"; questions: QuestionFormBlockQuestion[] }
  | { type: "references"; references: string[] }
  | { type: "image"; src: string; alt: string; caption?: string }
  | {
      type: "component";
      render: (ctx: { onOpenFile?: (filePath: string) => void }) => ReactNode;
    };

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

function TitleInline({
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

function IndicatorView({ ind }: { ind?: Indicator }) {
  if (!ind || ind.type === "none") return null;

  if (ind.type === "icon") {
    const IndicatorIcon = getIconComponent(ind.icon);
    return (
      <Timeline.Indicator outline="none" border="none" background="bg" color="fg">
        <Span display="inline-flex" alignItems="center">
          <IndicatorIcon size={14} strokeWidth={1} />
        </Span>
      </Timeline.Indicator>
    );
  }

  return (
    <Timeline.Indicator>
      <Avatar.Root boxSize="full">
        <Avatar.Image src={ind.src} alt={ind.alt} />
        <Avatar.Fallback background="bg.muted" color="fg.muted" />
      </Avatar.Root>
    </Timeline.Indicator>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <ScrollArea
      background="bg.code"
      color="fg.muted"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      showHorizontalScrollbar
      showVerticalScrollbar={false}
    >
      <Box
        as="pre"
        padding="sm"
        textStyle="mono/XS"
        whiteSpace="pre"
        aria-label={language ? `${language} code block` : "code block"}
      >
        <Box as="code">{code}</Box>
      </Box>
    </ScrollArea>
  );
}

function BlockView({ b, onOpenFile }: { b: Block; onOpenFile?: (filePath: string) => void }) {
  switch (b.type) {
    case "comment":
      return (
        <Card.Root>
          <Card.Body>{b.text}</Card.Body>
          {b.reactions?.clap ? (
            <Card.Footer>
              <Button>👏 {b.reactions.clap}</Button>
            </Card.Footer>
          ) : null}
        </Card.Root>
      );
    case "code":
      return (
        <Card.Root border="0" padding="0">
          <Card.Body padding="0">
            <CodeBlock language={b.language} code={b.code} />
          </Card.Body>
        </Card.Root>
      );
    case "diff":
      return (
        <Card.Root border="0" padding="0">
          <Card.Body padding="0">
            <Box height="240px" minW="320px" overflow="hidden">
              <DiffEditor
                original={b.original}
                modified={b.modified}
                language={b.language}
                sideBySide={b.sideBySide ?? false}
                disableScroll={true}
              />
            </Box>
          </Card.Body>
        </Card.Root>
      );
    case "text":
      return (
        <Card.Root background="transparent">
          <Card.Body padding="sm">
            <Text textStyle="label/S/regular">{b.text}</Text>
          </Card.Body>
        </Card.Root>
      );
    case "todo-list":
      return <TodoListBlockView items={b.items} />;
    case "question-form":
      return <QuestionFormBlockView questions={b.questions} />;
    case "references":
      return (
        <Stack mt="xs" gap="xs" flexDir="row" flexWrap="wrap">
          {b.references.map((ref) => (
            <ResourceBadge key={ref} fileName={ref} />
          ))}
        </Stack>
      );
    case "image":
      if (!b.src.trim()) return null;
      return (
        <Card.Root border="0" padding="0" background="transparent">
          <Card.Body padding="0">
            <Image
              src={b.src}
              alt={b.alt}
              maxH="18rem"
              maxW="full"
              objectFit="contain"
              borderRadius="sm"
              borderWidth="1px"
              borderColor="border.subtle"
            />
            {b.caption ? (
              <Text mt="2xs" textStyle="label/XS/regular" color="fg.muted">
                {b.caption}
              </Text>
            ) : null}
          </Card.Body>
        </Card.Root>
      );
    case "component":
      return <>{b.render({ onOpenFile })}</>;
  }
}

function TimelineItemRow({
  item,
  itemKey,
  isOpen,
  canExpand,
  hasBlocks,
  onToggle,
  onOpenFile,
}: {
  item: Item;
  itemKey: string;
  isOpen: boolean;
  canExpand: boolean;
  hasBlocks: boolean;
  onToggle: (key: string) => void;
  onOpenFile?: (filePath: string) => void;
}) {
  return (
    <Timeline.Item gap="xs" key={itemKey}>
      <Timeline.Connector>
        <Timeline.Separator />
        <IndicatorView ind={item.indicator} />
      </Timeline.Connector>
      <Timeline.Content h={isOpen ? "auto" : "20px"}>
        {item.title.length > 0 && (
          <Timeline.Title
            className="group"
            fontWeight="normal"
            display="flex"
            alignItems="center"
            minW="0"
            width="full"
            overflow="hidden"
            cursor={canExpand ? "pointer" : "default"}
            onClick={canExpand ? () => onToggle(itemKey) : undefined}
          >
            <Span display="flex" alignItems="center" gap="sm" flexWrap="nowrap" minW="0" width="full">
              <Span display="flex" alignItems="center" gap="xs" flexWrap="nowrap" minW="0" flex="1" overflow="hidden">
                {item.title.map((seg, i) => (
                  <TitleInline key={i} seg={seg} isClickable={canExpand} onOpenFile={onOpenFile} />
                ))}
              </Span>
              {canExpand ? (
                <Span
                  display="inline-flex"
                  alignItems="center"
                  transition="transform 200ms ease, color 200ms ease"
                  transform={isOpen ? "rotate(0deg)" : "rotate(-180deg)"}
                  color="transparent"
                  flexShrink="0"
                  _groupHover={{ color: "fg" }}
                >
                  <ChevronUpIcon size={12} />
                </Span>
              ) : null}
            </Span>
          </Timeline.Title>
        )}
        {hasBlocks ? (
          <Box display="grid" gridTemplateRows={isOpen ? "1fr" : "0fr"} transition="grid-template-rows 220ms ease">
            {isOpen ? (
              <Box
                overflow="hidden"
                opacity={1}
                transform="translateY(0)"
                transition="opacity 200ms ease, transform 200ms ease"
              >
                {item.blocks!.map((block, i) => (
                  <Box key={i}>
                    <BlockView b={block} onOpenFile={onOpenFile} />
                  </Box>
                ))}
              </Box>
            ) : null}
          </Box>
        ) : null}
      </Timeline.Content>
    </Timeline.Item>
  );
}

export function TimelineFromJSON({ data, onOpenFile }: { data: TimelineDoc; onOpenFile?: (filePath: string) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const getKey = (it: Item, idx: number) => (it.id ? `id:${it.id}` : `idx:${idx}`);

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Timeline.Root>
      {data.items.map((item, idx) => {
        const key = getKey(item, idx);
        const hasBlocks = (item.blocks?.length ?? 0) > 0;
        const canExpand = (item.expandable ?? true) && hasBlocks;
        const isOpen = canExpand ? (expanded[key] ?? false) : hasBlocks;

        return (
          <TimelineItemRow
            key={key}
            item={item}
            itemKey={key}
            isOpen={isOpen}
            canExpand={canExpand}
            hasBlocks={hasBlocks}
            onToggle={toggle}
            onOpenFile={onOpenFile}
          />
        );
      })}
    </Timeline.Root>
  );
}
