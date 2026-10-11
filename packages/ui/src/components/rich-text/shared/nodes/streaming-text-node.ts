import { $applyNodeReplacement, type EditorConfig, TextNode } from "lexical";

// A chunk owns its span for its lifetime. Lexical must not merge it with earlier text.
export class StreamingTextNode extends TextNode {
  static getType() {
    return "streaming-text";
  }
  static clone(node: StreamingTextNode) {
    return new StreamingTextNode(node.__text, node.__key);
  }
  static importJSON(serialized: ReturnType<TextNode["exportJSON"]>) {
    return $createStreamingTextNode(serialized.text).updateFromJSON(serialized);
  }
  createDOM(config: EditorConfig) {
    const element = super.createDOM(config);
    element.classList.add("streaming-text-chunk");
    return element;
  }
  exportJSON() {
    return { ...super.exportJSON(), type: "streaming-text" };
  }
}

export const $createStreamingTextNode = (text: string) => $applyNodeReplacement(new StreamingTextNode(text));
