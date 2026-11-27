// ICU common data (CmnD, format 1): sorted NUL-terminated resource names and
// 16-byte-aligned payloads. Offsets in the table are relative to its start.
// Building the package here keeps platform ICU tools out of cross-compilation.
export const packIcu = async (archive: Blob) => {
  const entries = await new Bun.Archive(new Uint8Array(await archive.arrayBuffer())).files();
  const names = [...entries.keys()].sort();
  if (!names.length || names.some((name) => !/^icudt76l\/[\w./-]+$/.test(name)))
    throw new Error("Unexpected ICU resource names");
  const align = (size: number) => Math.ceil(size / 16) * 16;
  let nameOffset = 4 + 8 * names.length;
  let dataOffset = align(nameOffset + names.reduce((total, name) => total + name.length + 1, 0));
  const size = dataOffset + names.reduce((total, name) => total + align(entries.get(name)!.size), 0);
  const file = Buffer.alloc(32 + size, 0xaa);
  file.fill(0, 0, 32);
  file.writeUInt16LE(32, 0);
  file.set([0xda, 0x27, 20, 0, 0, 0, 0, 0, 2, 0], 2);
  file.write("CmnD", 12);
  file[16] = 1;
  file[20] = 3;
  const body = file.subarray(32);
  body.writeUInt32LE(names.length);
  for (const [i, name] of names.entries()) {
    body.writeUInt32LE(nameOffset, 4 + i * 8);
    body.writeUInt32LE(dataOffset, 8 + i * 8);
    nameOffset += body.write(`${name}\0`, nameOffset, "ascii");
    const bytes = await entries.get(name)!.bytes();
    body.set(bytes, dataOffset);
    dataOffset += align(bytes.length);
  }
  return Bun.zstdCompressSync(file);
};
