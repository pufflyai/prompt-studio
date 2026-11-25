// Word order is part of the format so a saved session keeps its nickname after an upgrade.
const adjectives =
  "airy bold brisk calm clear cool cozy crisp deft dry fair fast firm fond free glad hale keen kind light lucid mild neat nimble proud quick quiet sharp snug still swift warm".split(
    " ",
  );
const starts =
  "al am an ar as av bel ben bri cal cam cor dan del dev el em en ev fel fin gal gen hal il in ir is iv jas jo jul kai kal kel kin lan len lin lor luc mar mel mil mir nal nel nor ol or pal per ren ria ros sal sel sol tal tev val ven wil zar".split(
    " ",
  );
const middles = "ba be bi bo ca ce da de di do fa fi ga gi ha ja ka ke la le li lo ma me mi na ne ni ra re ri ro".split(
  " ",
);
const ends =
  "bel ben da dal dan den di din el en er es ia iel in is ka la lan le len li lin lo ly ma mar mi min na ne nel ni nin no nor ra rai ran re ren ri rin ro ron sa sai san sel si sol ta tal tan te ti tin to va val vi vin ya zen".split(
    " ",
  );

export const sessionNickname = (id: string) => {
  let hash = 2166136261;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const bits = hash >>> 0;
  const adjective = adjectives[bits % adjectives.length];
  const nameBits = Math.floor(bits / adjectives.length);
  const start = starts[nameBits % starts.length];
  const rest = Math.floor(nameBits / starts.length);
  const middle = middles[rest % middles.length];
  const end = ends[Math.floor(rest / middles.length) % ends.length];
  return `${adjective}-${start}${middle}${end}`;
};
