export const portableSmokeImages = (project: string, images?: { relay: string; manager: string }) => {
  if (images && !Object.values(images).every((image) => /^sha256:[a-f0-9]{64}$/.test(image)))
    throw new Error("Prebuilt service smoke requires immutable loaded image IDs");
  return {
    prebuilt: images !== undefined,
    images: images ?? { relay: `${project}-relay`, manager: `${project}-manager` },
    buildServices: [...(images ? [] : ["relay", "manager"]), "tls", "initialize", "smoke"],
  };
};
