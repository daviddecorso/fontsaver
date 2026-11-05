import { extractFamilyFromHref } from '../../src/core/family-id';

export const SELECTORS = {
  specimenLink: 'a[href^="/specimen/"], a[href*="fonts.google.com/specimen/"]',
  cardMarker: 'data-gff',
  cardContainer: 'gf-tile, article, [role="listitem"], li, [data-card]',
  specimenTitle: 'h1',
} as const;

export function isSpecimenPage(pathname: string): boolean {
  return /^\/specimen\/[^/?#]+/.test(pathname);
}

export function findCardElement(link: HTMLElement): HTMLElement {
  const container = link.closest<HTMLElement>(SELECTORS.cardContainer);
  if (container) return container;

  let current: HTMLElement | null = link;
  while (
    current?.parentElement &&
    current.parentElement !== document.body &&
    current.parentElement.tagName !== 'MAIN'
  ) {
    if (
      current.parentElement.childElementCount > 1 &&
      !['P', 'SPAN', 'H1', 'H2', 'H3', 'H4'].includes(
        current.parentElement.tagName,
      )
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return link;
}

export interface MountTarget {
  container: HTMLElement;
  referenceNode?: Node | null;
}

export function findMountTarget(
  card: HTMLElement,
  link: HTMLElement,
): MountTarget {
  const titleLink =
    card.querySelector<HTMLElement>('header a, .tile__header a') ?? link;

  if (titleLink.parentElement) {
    return {
      container: titleLink.parentElement,
      referenceNode: titleLink,
    };
  }

  const header = card.querySelector<HTMLElement>('header, .tile__header');
  if (header) {
    return {
      container: header,
      referenceNode: header.firstChild,
    };
  }

  return {
    container: card,
    referenceNode: card.firstChild,
  };
}

export { extractFamilyFromHref };
