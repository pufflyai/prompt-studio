// The one-time Monaco build ships plain JavaScript, so its module shape is declared here.
declare module "@pstdio/ui/monaco/monaco.js" {
  export const monaco: typeof import("monaco-editor");
}
