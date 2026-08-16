export interface MarkdownSectionAnchor {
  id: string;
  heading: string;
  occurrence?: number;
}

export interface MarkdownSectionNavigation {
  anchors: MarkdownSectionAnchor[];
  targetId: string;
}

export interface MatchedMarkdownSection {
  id: string;
  headingIndex: number;
}

interface MarkdownSectionPosition {
  id: string;
  top: number;
}

const normalizeHeading = (value: string) => value.trim().replace(/\s+/g, " ");

export const matchMarkdownSectionAnchors = (headings: string[], anchors: MarkdownSectionAnchor[]) => {
  const normalizedHeadings = headings.map(normalizeHeading);
  const implicitOccurrences = new Map<string, number>();
  const matches: MatchedMarkdownSection[] = [];

  for (const anchor of anchors) {
    const heading = normalizeHeading(anchor.heading);
    const occurrence = anchor.occurrence ?? implicitOccurrences.get(heading) ?? 0;
    implicitOccurrences.set(heading, occurrence + 1);
    let seen = 0;

    for (const [headingIndex, candidate] of normalizedHeadings.entries()) {
      if (candidate !== heading) continue;
      if (seen === occurrence) {
        matches.push({ id: anchor.id, headingIndex });
        break;
      }
      seen += 1;
    }
  }

  return matches.sort((left, right) => left.headingIndex - right.headingIndex);
};

export const resolveActiveMarkdownSection = (sections: MarkdownSectionPosition[], threshold: number) => {
  const first = sections[0]?.id;
  let active = first;

  for (const section of sections) {
    if (section.top > threshold) break;
    active = section.id;
  }

  return active;
};
