type State = "text" | "escape" | "csi" | "osc" | "string" | "oscEscape" | "stringEscape";
const controls = new Map<string, State>([
  ["\x1b", "escape"],
  ["\x9b", "csi"],
  ["\x9d", "osc"],
  ["\x90", "string"],
  ["\x98", "string"],
  ["\x9e", "string"],
  ["\x9f", "string"],
]);
const escapes: Record<string, State> = { "[": "csi", "]": "osc", P: "string", X: "string", "^": "string", _: "string" };

function stringState(kind: "osc" | "string", escaped: boolean, char: string): State {
  if (char === "\x9c" || (kind === "osc" && char === "\x07") || (escaped && char === "\\")) return "text";
  if (char === "\x1b") return kind === "osc" ? "oscEscape" : "stringEscape";
  return kind;
}

const next: Record<Exclude<State, "text">, (char: string) => State> = {
  escape(char) {
    if (escapes[char]) return escapes[char];
    if (char === "\x1b" || (char >= " " && char <= "/")) return "escape";
    return "text";
  },
  csi(char) {
    if (char === "\x1b") return "escape";
    if (char >= "@" && char <= "~") return "text";
    return "csi";
  },
  osc: (char) => stringState("osc", false, char),
  string: (char) => stringState("string", false, char),
  oscEscape: (char) => stringState("osc", true, char),
  stringEscape: (char) => stringState("string", true, char),
};

// Keep only visible tail text. Escape state crosses controller chunks/pages without
// retaining an unbounded OSC title, hyperlink or other terminal control payload.
export function createLogTail(limit: number) {
  let text = "";
  let omitted = false;
  let state: State = "text";
  const retain = (part: string) => {
    if (text.length + part.length > limit) omitted = true;
    text = (text + part).slice(-limit);
  };
  return {
    append(chunk: string) {
      let start = 0;
      for (let index = 0; index < chunk.length; index++) {
        const char = chunk.charAt(index);
        if (state === "text") {
          const control = controls.get(char);
          if (!control) continue;
          retain(chunk.slice(start, index));
          state = control;
        } else state = next[state](char);
        start = index + 1;
      }
      if (state === "text") retain(chunk.slice(start));
    },
    read: () => `${omitted ? "[Earlier output omitted]\n" : ""}${text}`,
  };
}
