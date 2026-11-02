import { documentParticipantColors } from "@pstdio/ui";

export const participantColor = (id: string) => {
  let hash = 0;
  for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return documentParticipantColors[hash % documentParticipantColors.length]!;
};
