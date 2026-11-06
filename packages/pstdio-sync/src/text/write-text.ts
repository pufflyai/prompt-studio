import diff from "fast-diff";
import type * as Y from "yjs";

export const writeText = (text: Y.Text, next: string) => {
  let index = 0;
  for (const [operation, value] of diff(text.toString(), next)) {
    if (operation === -1) text.delete(index, value.length);
    else {
      if (operation === 1) text.insert(index, value);
      index += value.length;
    }
  }
};
