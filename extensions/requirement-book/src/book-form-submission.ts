export const submitBookForm = async (input: {
  persist(): Promise<void>;
  submit(): Promise<void>;
  discard(): Promise<void>;
  close(): void;
}) => {
  await input.persist();
  await input.submit();
  try {
    await input.discard();
  } finally {
    // A successful submission cannot be attempted again because draft cleanup failed.
    input.close();
  }
};
