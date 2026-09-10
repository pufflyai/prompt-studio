interface HostIdentity {
  uid?: number;
  gid?: number;
}

export const resolveIsolatedUser = (
  { uid = 1000, gid = 1000 }: HostIdentity = { uid: process.getuid?.(), gid: process.getgid?.() },
) => {
  if (uid === 0) throw new Error("Run isolated development without sudo so checkout files stay owned by your user.");
  return { HOST_UID: String(uid), HOST_GID: String(gid) };
};
