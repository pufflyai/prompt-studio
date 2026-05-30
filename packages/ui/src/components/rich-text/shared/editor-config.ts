import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { CHECK_LIST, LINK as LEXICAL_LINK, TRANSFORMERS } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import type { Klass, LexicalNode } from "lexical";
import { REFERENCE_LINK_TRANSFORMER, ReferenceLinkNode } from "../markdown-editor/plugins/ReferenceLinkPlugin";
import theme from "../theme/rich-text-theme";
import { CodeHighlightNode, CodeNode } from "./lexical-code";
import { DataTableNode } from "./nodes/DataTableNode";
import { EquationNode } from "./plugins/EquationPlugin/EquationNode";
import { EQUATION_INLINE, EQUATION_MULTILINE } from "./plugins/EquationPlugin/EquationPlugin";
import { HRNode } from "./plugins/HorizontalRulePlugin/HorizontalRuleNode";
import { MermaidNode } from "./plugins/MermaidPlugin/MermaidNode";
import { TRANSFORMERS_EXTENDED } from "./transformers/markdown-transformers";

export const editorNodes: Array<Klass<LexicalNode>> = [
  QuoteNode,
  LinkNode,
  AutoLinkNode,
  DataTableNode,
  HeadingNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  MermaidNode,
  EquationNode,
  HRNode,
  ReferenceLinkNode,
];

export const baseEditorTransformers = [
  CHECK_LIST,
  ...TRANSFORMERS.filter((transformer) => transformer !== LEXICAL_LINK),
  ...TRANSFORMERS_EXTENDED,
  EQUATION_INLINE,
  EQUATION_MULTILINE,
];

export const editorTransformers = [...baseEditorTransformers, REFERENCE_LINK_TRANSFORMER];

export const editorTheme = theme;
