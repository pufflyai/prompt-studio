import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Locator } from "@playwright/test";

const skillFilePaths = [
  ".agents/skills/create-proposal/SKILL.md",
  ".agents/skills/create-pstdio-extension/references/examples.md",
  ".agents/skills/create-pstdio-extension/references/extension-api.md",
  ".agents/skills/create-pstdio-extension/references/scope.md",
  ".agents/skills/create-pstdio-extension/references/validation.md",
  ".agents/skills/create-pstdio-extension/SKILL.md",
  ".agents/skills/create-sub-tickets/SKILL.md",
  ".agents/skills/create-ticket/SKILL.md",
  ".agents/skills/implement-ticket/SKILL.md",
  ".agents/skills/pstdio/references/cli-reference.md",
  ".agents/skills/pstdio/SKILL.md",
  ".agents/skills/refine-ticket/SKILL.md",
  ".claude/skills/create-proposal/SKILL.md",
  ".claude/skills/create-pstdio-extension/references/examples.md",
  ".claude/skills/create-pstdio-extension/references/extension-api.md",
  ".claude/skills/create-pstdio-extension/references/scope.md",
  ".claude/skills/create-pstdio-extension/references/validation.md",
  ".claude/skills/create-pstdio-extension/SKILL.md",
  ".claude/skills/create-sub-tickets/SKILL.md",
  ".claude/skills/create-ticket/SKILL.md",
  ".claude/skills/implement-ticket/SKILL.md",
  ".claude/skills/pstdio/references/cli-reference.md",
  ".claude/skills/pstdio/SKILL.md",
  ".claude/skills/refine-ticket/SKILL.md",
];

const getLineCount = (path: string) => {
  if (path.includes("create-ticket")) return 105;
  if (path.includes("cli-reference") || path.endsWith("pstdio/SKILL.md")) return 149;
  return 35;
};

const writeChangedFile = (worktreePath: string, filePath: string, lineCount: number) => {
  const absolutePath = join(worktreePath, filePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(
    absolutePath,
    `# ${filePath}\n\n${Array.from({ length: lineCount }, (_, index) => `line ${index + 1}`).join("\n")}\n`,
  );
};

export const createLargeCommittedDiff = (worktreePath: string, fileCount: number) => {
  for (const filePath of skillFilePaths) {
    writeChangedFile(worktreePath, filePath, getLineCount(filePath));
  }

  for (let index = 1; index <= fileCount; index += 1) {
    const fileNumber = String(index).padStart(3, "0");
    writeChangedFile(worktreePath, `file-${fileNumber}.txt`, 26);
  }

  execSync("git add .", { cwd: worktreePath, stdio: "pipe" });
  execSync("git add -f .agents", { cwd: worktreePath, stdio: "pipe" });
  execSync("git add -f .claude", { cwd: worktreePath, stdio: "pipe" });
  execSync('git commit -m "add large diff"', { cwd: worktreePath, stdio: "pipe" });
};

export const scrollTreeListToBottom = async (listbox: Locator) => {
  await listbox.evaluate((element) => {
    const viewport = element.closest('[data-part="viewport"]');
    if (!(viewport instanceof HTMLElement)) {
      throw new Error("Tree list scroll viewport not found");
    }

    viewport.scrollTop = viewport.scrollHeight;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
};

export const scrollTreeListToTop = async (listbox: Locator) => {
  await listbox.evaluate((element) => {
    const viewport = element.closest('[data-part="viewport"]');
    if (!(viewport instanceof HTMLElement)) {
      throw new Error("Tree list scroll viewport not found");
    }

    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
};

export const readSelectedCardOffsetFromHeader = async (header: Locator) =>
  header.evaluate((element) => {
    const card = element.closest('[data-testid="diff-card"]');
    if (!(card instanceof HTMLElement)) {
      throw new Error("Selected diff card not found");
    }

    const viewport = card.closest('[data-part="viewport"]');
    if (!(viewport instanceof HTMLElement)) return Number.POSITIVE_INFINITY;

    const elementRect = card.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    return elementRect.top - viewportRect.top;
  });

export const readHeaderOffsetFromViewport = async (header: Locator) =>
  header.evaluate((element) => {
    const viewport = element.closest('[data-part="viewport"]');
    if (!(viewport instanceof HTMLElement)) return Number.POSITIVE_INFINITY;

    const elementRect = element.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    return elementRect.top - viewportRect.top;
  });

export const readDiffViewportScrollTop = async (diffViewer: Locator) =>
  diffViewer.evaluate((element) => {
    const card = element.querySelector<HTMLElement>('[data-testid="diff-card"]');
    const viewport = card?.closest('[data-part="viewport"]');
    if (!(viewport instanceof HTMLElement)) return 0;

    return viewport.scrollTop;
  });

export const readRenderedDiffCardGaps = async (diffViewer: Locator) =>
  diffViewer.evaluate((element) => {
    const cards = Array.from(element.querySelectorAll<HTMLElement>('[data-testid="diff-card"]'));
    const renderedCards = cards
      .map((card) => {
        const wrapper = card.closest<HTMLElement>("[data-index]");
        const rect = card.getBoundingClientRect();
        return {
          index: Number(wrapper?.dataset.index),
          top: rect.top,
          bottom: rect.bottom,
        };
      })
      .filter((card) => Number.isInteger(card.index))
      .sort((a, b) => a.top - b.top);

    const gaps: number[] = [];
    for (let index = 1; index < renderedCards.length; index += 1) {
      const previous = renderedCards[index - 1];
      const current = renderedCards[index];
      if (current.index !== previous.index + 1) continue;

      gaps.push(Math.round(current.top - previous.bottom));
    }
    return gaps;
  });
