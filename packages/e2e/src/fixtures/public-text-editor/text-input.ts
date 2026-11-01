import type * as Y from "yjs";

const splitsCharacter = (value: string, index: number) => index > 0 && (value.codePointAt(index - 1) ?? 0) > 0xffff;

export const replaceText = (text: Y.Text, next: string) => {
  const previous = text.toString();
  let start = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) start++;
  // Yjs replaces invalid halves when a deletion splits a UTF-16 surrogate pair.
  if (splitsCharacter(previous, start)) start--;
  let end = 0;
  while (
    end < previous.length - start &&
    end < next.length - start &&
    previous[previous.length - end - 1] === next[next.length - end - 1]
  )
    end++;
  if (splitsCharacter(previous, previous.length - end)) end--;
  text.delete(start, previous.length - start - end);
  text.insert(start, next.slice(start, next.length - end));
};
