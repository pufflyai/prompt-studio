import { $isElementNode, type RootNode } from "lexical";

export const $getTextContent = (root: RootNode) => {
  let textContent = "";
  const children = root.getChildren();
  const childrenLength = children.length;
  for (let i = 0; i < childrenLength; i++) {
    const child = children[i];
    textContent += child.getTextContent();
    if ($isElementNode(child) && i !== childrenLength - 1 && !child.isInline()) {
      textContent += "\n";
    }
  }
  return textContent;
};

type SerializedNode = {
  type?: string;
  text?: string;
  name?: string;
  referenceId?: string;
  children?: SerializedNode[];
};

type SerializedRoot = {
  root?: SerializedNode;
};

const getReferenceMarker = (node: SerializedNode) => {
  if (node.type !== "reference") return null;
  return `#${node.name ?? node.referenceId ?? ""}`;
};

const shouldAppendParagraphBreak = (node: SerializedNode) => {
  return node.type === "paragraph" && Boolean(node.children?.length);
};

const traverseSerializedNode = (node: SerializedNode): string => {
  if (node.type === "comment") {
    return "";
  }

  const referenceMarker = getReferenceMarker(node);
  if (referenceMarker !== null) {
    return referenceMarker;
  }

  let text = typeof node.text === "string" ? node.text : "";
  const children = node.children;
  if (!Array.isArray(children)) return text;

  const childrenLength = children.length;
  for (let i = 0; i < childrenLength; i += 1) {
    const child = children[i];
    if (child.type === "comment") {
      if (i !== childrenLength - 1) {
        text += "\n";
      }
      continue;
    }

    text += traverseSerializedNode(child);
    if (shouldAppendParagraphBreak(child)) {
      text += "\n";
    }
  }

  return text;
};

export const getTextFromSerializedEditorState = (state: string): string => {
  try {
    const parsed = JSON.parse(state) as SerializedRoot;
    return traverseSerializedNode(parsed.root ?? {});
  } catch {
    return "";
  }
};

export const emptyEditorState = {
  root: {
    direction: "ltr",
    format: "",
    indent: 0,
    type: "root",
    version: 1,
    children: [
      {
        type: "paragraph",
        version: 1,
        format: "",
        indent: 0,
        textFormat: undefined,
        direction: null,
        children: [],
      },
    ],
  },
};

export function generateEditorStateFromString(input = "") {
  if (!input.trim()) {
    return JSON.parse(JSON.stringify(emptyEditorState));
  }

  // Split on line breaks → one paragraph per line
  const paragraphs = input.split(/\r?\n/);

  const children = paragraphs.map((line) => ({
    type: "paragraph",
    version: 1,
    format: "",
    indent: 0,
    textFormat: undefined,
    direction: null,
    children: line
      ? [
          {
            type: "text",
            version: 1,
            text: line,
            format: "",
            detail: 0,
            mode: "normal",
            style: "",
          },
        ]
      : [],
  }));

  return {
    root: {
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
      children,
    },
  };
}
