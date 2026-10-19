import { ChatResourceLinkNode, type SerializedChatResourceLink } from "./chat-resource-link-node";
import { ChatWebLink } from "./chat-web-link";

// A read-only web link bubble. It copies, pastes and streams like the other chat bubbles.
export class ChatWebLinkNode extends ChatResourceLinkNode {
  static getType() {
    return "chat-web-link";
  }
  static clone(node: ChatWebLinkNode) {
    return new ChatWebLinkNode(node.__candidate, node.__label, node.__format, node.__key);
  }
  static importJSON(value: SerializedChatResourceLink) {
    return new ChatWebLinkNode(value.candidate, value.label, value.format);
  }
  decorate() {
    return <ChatWebLink source={this.__candidate.source} label={this.__label} />;
  }
}
