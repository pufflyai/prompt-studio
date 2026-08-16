import { Box, Code, Link, Text } from "@chakra-ui/react";
import type { PhrasingContent } from "mdast";
import { Fragment, type ReactNode } from "react";
import { parseMarkdownInline } from "./markdown-ast";
import { resolveMarkdownUrl } from "./markdown-url";
import { useMarkdownUrlResolver } from "./markdown-url-context";
import { MarkdownImage } from "./nodes/MarkdownImageNode";
import { RawHtml } from "./nodes/RawHtmlNode";

interface MarkdownInlineProps {
  value: string;
}

interface InlineChildrenProps {
  nodes: PhrasingContent[];
}

const InlineChildren = (props: InlineChildrenProps) => {
  const { nodes } = props;
  const resolver = useMarkdownUrlResolver();

  return nodes.map((node, index): ReactNode => {
    const key = `${node.type}-${index}`;

    switch (node.type) {
      case "text":
        return <Fragment key={key}>{node.value}</Fragment>;
      case "strong":
        return (
          <Text as="strong" key={key} fontWeight="semibold">
            <InlineChildren nodes={node.children} />
          </Text>
        );
      case "emphasis":
        return (
          <Box as="em" key={key}>
            <InlineChildren nodes={node.children} />
          </Box>
        );
      case "delete":
        return (
          <Box as="del" key={key}>
            <InlineChildren nodes={node.children} />
          </Box>
        );
      case "inlineCode":
        return <Code key={key}>{node.value}</Code>;
      case "break":
        return <br key={key} />;
      case "link": {
        const href = resolveMarkdownUrl(node.url, "link", resolver);
        if (!href) return <InlineChildren key={key} nodes={node.children} />;
        return (
          <Link key={key} href={href} title={node.title ?? undefined} target="_blank" rel="noopener noreferrer">
            <InlineChildren nodes={node.children} />
          </Link>
        );
      }
      case "image":
        return <MarkdownImage key={key} source={node.url} alt={node.alt ?? ""} title={node.title ?? null} />;
      case "html":
        return <RawHtml key={key} source={node.value} display="inline" />;
      case "inlineMath":
        return <Code key={key}>{node.value}</Code>;
      default:
        return null;
    }
  });
};

export const MarkdownInline = (props: MarkdownInlineProps) => {
  const { value } = props;
  return <InlineChildren nodes={parseMarkdownInline(value)} />;
};
