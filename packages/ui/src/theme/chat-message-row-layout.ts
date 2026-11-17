// Shared static row geometry is emitted once. Streaming text must not reserialize it per measured frame.
export const chatMessageRowLayoutCss = {
  ".ps-chat-response-row-layout, .ps-chat-user-row-layout": {
    position: "absolute",
    left: "0",
    width: "100%",
  },
  ".ps-chat-user-row-layout": {
    zIndex: 1,
    pointerEvents: "none",
  },
  ".ps-chat-sticky-row-layout": {
    position: "sticky",
    top: "0",
    pointerEvents: "auto",
  },
  ".ps-chat-response-row-layout[data-chat-row-gap], .ps-chat-sticky-row-layout[data-chat-row-gap]": {
    pb: "xs",
  },
};
