export const submitBookForm = async (input: { persist(): Promise<void>; submit(): Promise<void>; close(): void }) => {
  await input.persist();
  await input.submit();
  input.close();
};
