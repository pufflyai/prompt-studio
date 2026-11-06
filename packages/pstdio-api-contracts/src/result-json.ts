const CHUNK_CHARS = 8192;

// JSON protocol values are walked in chunks so budgeting never copies an entire result.
export const visitText = (value: string, write: (chunk: string) => void) => {
  for (let start = 0; start < value.length; ) {
    let end = Math.min(start + CHUNK_CHARS, value.length);
    const last = value.charCodeAt(end - 1);
    if (end < value.length && last >= 0xd800 && last <= 0xdbff) end--;
    write(value.slice(start, end));
    start = end;
  }
};

export const visitJson = (value: unknown, write: (chunk: string) => void, canonical = true) => {
  const string = (item: string) => {
    write('"');
    visitText(item, (chunk) => write(JSON.stringify(chunk).slice(1, -1)));
    write('"');
  };
  const array = (items: unknown[]) => {
    write("[");
    for (let index = 0; index < items.length; index++) {
      if (index) write(",");
      visit(items[index]);
    }
    write("]");
  };
  const object = (item: object) => {
    write("{");
    let first = true;
    const keys = Object.keys(item);
    if (canonical) keys.sort();
    for (const key of keys) {
      const child = (item as Record<string, unknown>)[key];
      if (child === undefined || typeof child === "function" || typeof child === "symbol") continue;
      if (!first) write(",");
      first = false;
      string(key);
      write(":");
      visit(child);
    }
    write("}");
  };
  const visit = (item: unknown) => {
    if (typeof item === "string") string(item);
    else if (Array.isArray(item)) array(item);
    else if (item && typeof item === "object") object(item);
    else write(JSON.stringify(item) ?? "null");
  };
  visit(value);
};
