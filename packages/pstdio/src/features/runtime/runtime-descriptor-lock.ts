import { acquireFileMutationLock } from "pstdio-paths";

export const acquireRuntimeDescriptorLock = (descriptorPath: string) =>
  acquireFileMutationLock(descriptorPath, "runtime descriptor");

export const withRuntimeDescriptorLock = <T>(descriptorPath: string, operation: () => T) => {
  const release = acquireRuntimeDescriptorLock(descriptorPath);
  try {
    return operation();
  } finally {
    release();
  }
};
