const incompletePrefixLength = (data: Buffer, prefix: Buffer) => {
  let held = Math.min(prefix.length - 1, data.length);
  while (held > 0 && !data.subarray(-held).equals(prefix.subarray(0, held))) held--;
  return held;
};

// Per-terminal markers are removed before output reaches the terminal renderer.
export const createTerminalShellState = (id: string) => {
  const prefix = Buffer.from(`\x1b]633;PSTDIO=${id};`);
  let pending = Buffer.alloc(0);
  let atPrompt = false;
  return {
    atPrompt: () => atPrompt,
    onInput: (data: string | Uint8Array) => {
      const bytes = typeof data === "string" ? Buffer.from(data) : data;
      if (bytes.includes(10) || bytes.includes(13)) atPrompt = false;
    },
    onData(chunk: Uint8Array) {
      pending = Buffer.concat([pending, chunk]);
      const output: Uint8Array[] = [];
      while (pending.length > 0) {
        const start = pending.indexOf(prefix);
        if (start === -1) {
          const held = incompletePrefixLength(pending, prefix);
          output.push(pending.subarray(0, pending.length - held));
          pending = pending.subarray(pending.length - held);
          break;
        }
        output.push(pending.subarray(0, start));
        pending = pending.subarray(start);
        const end = pending.indexOf(7, prefix.length);
        if (end === -1 && pending.length <= prefix.length + 7) break;
        const state = end === -1 ? "" : pending.subarray(prefix.length, end).toString();
        if (state === "prompt" || state === "busy") {
          atPrompt = state === "prompt";
          pending = pending.subarray(end + 1);
        } else {
          output.push(pending.subarray(0, 1));
          pending = pending.subarray(1);
        }
      }
      return new Uint8Array(Buffer.concat(output));
    },
  };
};
