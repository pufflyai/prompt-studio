const encoder = new TextEncoder();
const decoder = new TextDecoder();

const decodeHead = (bytes: Uint8Array) => {
  let end = bytes.length;
  let start = end - 1;
  while (start >= 0 && (bytes[start] & 0xc0) === 0x80) start--;
  if (start >= 0) {
    const leading = bytes[start];
    let width = 1;
    if (leading >= 0xf0) width = 4;
    else if (leading >= 0xe0) width = 3;
    else if (leading >= 0xc0) width = 2;
    if (start + width > end) end = start;
  }
  return decoder.decode(bytes.subarray(0, end));
};

export const createResultTextWindow = (capacity: number) => {
  const head = new Uint8Array(capacity);
  const tail = new Uint8Array(capacity);
  let size = 0;
  let headSize = 0;
  let tailSize = 0;
  let cursor = 0;
  return {
    append(text: string) {
      const bytes = encoder.encode(text);
      size += bytes.length;
      const kept = Math.min(capacity - headSize, bytes.length);
      head.set(bytes.subarray(0, kept), headSize);
      headSize += kept;
      const end = bytes.subarray(Math.max(0, bytes.length - capacity));
      const first = Math.min(capacity - cursor, end.length);
      tail.set(end.subarray(0, first), cursor);
      tail.set(end.subarray(first), 0);
      cursor = (cursor + end.length) % capacity;
      tailSize = Math.min(capacity, tailSize + end.length);
    },
    get size() {
      return size;
    },
    get retainedBytes() {
      return headSize + tailSize;
    },
    head: () => decodeHead(head.subarray(0, headSize)),
    tail: () => {
      const ordered = new Uint8Array(tailSize);
      const start = tailSize === capacity ? cursor : 0;
      const first = Math.min(capacity - start, tailSize);
      ordered.set(tail.subarray(start, start + first));
      ordered.set(tail.subarray(0, tailSize - first), first);
      let offset = 0;
      while (offset < ordered.length && (ordered[offset] & 0xc0) === 0x80) offset++;
      return decoder.decode(ordered.subarray(offset));
    },
  };
};

export const utf8Bytes = (value: string) => encoder.encode(value).length;

// Allowance is measured after JSON escaping, not in UTF-16 code units.
export const fitResultText = (value: string, allowance: number, end: boolean) => {
  let low = 0;
  let high = value.length;
  const slice = (length: number) => {
    let start = end ? value.length - length : 0;
    let stop = end ? value.length : length;
    if (start > 0 && value.charCodeAt(start) >= 0xdc00 && value.charCodeAt(start) <= 0xdfff) start++;
    if (stop < value.length && value.charCodeAt(stop - 1) >= 0xd800 && value.charCodeAt(stop - 1) <= 0xdbff) stop--;
    return value.slice(start, stop);
  };
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (utf8Bytes(JSON.stringify(slice(middle))) - 2 <= allowance) low = middle;
    else high = middle - 1;
  }
  return slice(low);
};
