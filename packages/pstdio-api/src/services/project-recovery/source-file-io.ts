import { fsync, write } from "node:fs";

export const writeRecoverySourceFile = async (fd: number, bytes: Uint8Array) => {
  let offset = 0;
  while (offset < bytes.length) {
    const written = await new Promise<number>((resolve, reject) =>
      write(fd, bytes, offset, bytes.length - offset, offset, (error, written) =>
        error ? reject(error) : resolve(written),
      ),
    );
    if (!written) throw new Error("The recovery policy write did not advance");
    offset += written;
  }
  await new Promise<void>((resolve, reject) => fsync(fd, (error) => (error ? reject(error) : resolve())));
};
