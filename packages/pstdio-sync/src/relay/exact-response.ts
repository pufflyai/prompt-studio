/** The caller validates the authenticated extent against its protocol's node limit. */
export const readExactResponse = async (response: Response, byteLength: number) => {
  const reader = response.body?.getReader();
  try {
    if (!Number.isSafeInteger(byteLength) || byteLength < 0) throw new Error("Invalid manifest blob length");
    const advertised = response.headers.get("pstdio-byte-length");
    if (advertised !== null && advertised !== String(byteLength))
      throw new Error("Manifest blob length differs from authenticated extent");
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.length > byteLength - offset) throw new Error("Manifest blob length exceeds authenticated extent");
        bytes.set(value, offset);
        offset += value.length;
      }
    }
    if (offset !== byteLength) throw new Error("Manifest blob length is shorter than authenticated extent");
    return bytes;
  } finally {
    try {
      await reader?.cancel();
    } finally {
      reader?.releaseLock();
    }
  }
};
