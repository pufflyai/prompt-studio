import { type EditorConfig, type NodeKey, type SerializedTextNode, TextNode } from "lexical";

export class ChatCodeLinkNode extends TextNode {
  __href: string | null;
  __description?: string;
  static getType() {
    return "chat-code-link";
  }
  static clone(node: ChatCodeLinkNode) {
    return new ChatCodeLinkNode(node.__text, node.__href, node.__description, node.__key);
  }
  constructor(text: string, href: string | null, description?: string, key?: NodeKey) {
    super(text, key);
    this.__href = href;
    this.__description = description;
  }
  static importJSON(value: SerializedTextNode) {
    return new ChatCodeLinkNode(value.text, null).updateFromJSON(value);
  }
  exportJSON(): SerializedTextNode {
    return { ...super.exportJSON(), type: "chat-code-link" };
  }
  createDOM(config: EditorConfig) {
    const anchor = document.createElement("a");
    if (this.__href) anchor.href = this.__href;
    else {
      anchor.setAttribute("role", "button");
      anchor.tabIndex = 0;
    }
    anchor.dataset.chatSource = this.__text;
    anchor.dataset.chatOrigin = "inline-code";
    anchor.title = this.__description ?? `Open file: ${this.__text}`;
    anchor.append(super.createDOM(config));
    return anchor;
  }
  updateDOM(previous: ChatCodeLinkNode) {
    return previous.__text !== this.__text || previous.__format !== this.__format || previous.__href !== this.__href;
  }
}
