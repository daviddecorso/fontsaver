import { familyNameToFontId } from '../../src/core/family-id';
import {
  buildFontsourceSnippet,
  buildGoogleImportSnippet,
  buildGoogleLinkSnippet,
  type SnippetContext,
} from '../../src/core/snippets';
import type {
  CatalogFont,
  Favorite,
  StorageMode,
  Tag,
} from '../../src/core/types';
import {
  catalogItem,
  defineFavoriteItem,
  localTagsItem,
  settingsItem,
  tagsItem,
} from '../../src/storage/items';

export interface HeartMountOptions {
  family: string;
  catalog?: CatalogFont[];
  isFavorited?: boolean;
  onToggle?: (isFavorited: boolean) => void;
  onCopied?: (format: string) => void;
}

const HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

const STYLES = `
:host {
  display: inline-flex;
  position: relative;
  z-index: 10;
  vertical-align: middle;
  align-items: center;
  justify-content: center;
  line-height: 1;
  user-select: none;
  margin-right: 6px;
  flex-shrink: 0;
}

.gff-heart-btn {
  all: unset;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  color: #5f6368;
  transition: transform 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.gff-heart-btn:hover {
  background-color: rgba(60, 64, 67, 0.08);
  transform: scale(1.08);
}

.gff-heart-btn:active {
  transform: scale(0.92);
}

.gff-heart-btn:focus-visible {
  outline: 2px solid #1a73e8;
  outline-offset: 2px;
}

.gff-heart-btn.favorited {
  color: #ea4335;
}

.gff-heart-icon {
  width: 20px;
  height: 20px;
  transition: fill 0.15s ease, stroke 0.15s ease;
}

.gff-heart-btn:not(.favorited) .gff-heart-icon {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}

.gff-heart-btn.favorited .gff-heart-icon {
  fill: currentColor;
  stroke: currentColor;
  stroke-width: 1;
}

.gff-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 210px;
  background: #ffffff;
  color: #202124;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.06);
  padding: 10px;
  z-index: 99999;
  display: none;
  flex-direction: column;
  gap: 10px;
  font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  box-sizing: border-box;
}

.gff-menu.visible {
  display: flex;
}

.gff-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gff-section-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #70757a;
  font-weight: 500;
}

.gff-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.gff-tag-chip {
  all: unset;
  display: inline-flex;
  align-items: center;
  border: 1px solid #dadce0;
  border-radius: 12px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 12px;
  background: transparent;
  color: #3c4043;
  transition: all 0.12s ease;
}

.gff-tag-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 5px;
  flex-shrink: 0;
}

.gff-tag-chip:hover {
  border-color: #1a73e8;
  color: #1a73e8;
}

.gff-tag-chip.active {
  background: #e8f0fe;
  border-color: #1a73e8;
  color: #1a73e8;
  font-weight: 500;
}

.gff-empty-tags {
  font-size: 12px;
  color: #70757a;
  line-height: 1.4;
}

.gff-open-lib-btn {
  all: unset;
  display: inline-block;
  margin-top: 4px;
  font-size: 11px;
  color: #1a73e8;
  cursor: pointer;
  text-decoration: underline;
}

.gff-open-lib-btn:hover {
  color: #1557b0;
}

.gff-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-top: 1px solid #f1f3f4;
  padding-top: 6px;
}

.gff-action-btn {
  all: unset;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: #3c4043;
  transition: background 0.12s ease;
}

.gff-action-btn:hover {
  background: #f1f3f4;
  color: #202124;
}

.gff-toast {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #202124;
  color: #ffffff;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 100000;
}

.gff-toast.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(-2px);
}
`;

export function mountHeartButton(
  container: HTMLElement,
  options: HeartMountOptions,
  referenceNode?: Node | null,
): { unmount: () => void } {
  const host = document.createElement('span');
  host.className = 'gff-heart-host';
  host.setAttribute('data-gff-heart', options.family);

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = STYLES;
  shadow.appendChild(style);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'gff-heart-btn';
  button.setAttribute('aria-label', `Favorite ${options.family}`);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'gff-heart-icon');
  svg.setAttribute('viewBox', '0 0 24 24');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', HEART_PATH);
  svg.appendChild(path);
  button.appendChild(svg);
  shadow.appendChild(button);

  const menu = document.createElement('div');
  menu.className = 'gff-menu';
  shadow.appendChild(menu);

  const toast = document.createElement('div');
  toast.className = 'gff-toast';
  shadow.appendChild(toast);

  let isFavorited = options.isFavorited ?? false;
  let currentFavorite: Favorite | null = null;
  let openTimer: ReturnType<typeof setTimeout> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  const fontId = familyNameToFontId(options.family, options.catalog);
  let activeMode: StorageMode = 'sync';
  let favoriteItem = defineFavoriteItem(fontId, activeMode);

  const updateUI = () => {
    if (isFavorited) {
      button.classList.add('favorited');
      button.setAttribute('aria-pressed', 'true');
      button.setAttribute('aria-label', `Unfavorite ${options.family}`);
    } else {
      button.classList.remove('favorited');
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `Favorite ${options.family}`);
    }
  };

  updateUI();

  let unwatch = favoriteItem.watch((newVal) => {
    currentFavorite = newVal;
    isFavorited = Boolean(newVal);
    updateUI();
  });

  const syncFavoriteState = async () => {
    const settings = await settingsItem.getValue();
    const mode = settings?.storageMode ?? 'sync';
    if (mode !== activeMode) {
      activeMode = mode;
      unwatch();
      favoriteItem = defineFavoriteItem(fontId, activeMode);
      unwatch = favoriteItem.watch((newVal) => {
        currentFavorite = newVal;
        isFavorited = Boolean(newVal);
        updateUI();
      });
    }

    const stored = await favoriteItem.getValue();
    if (stored !== null) {
      currentFavorite = stored;
      isFavorited = true;
      updateUI();
    }
  };

  void syncFavoriteState();

  const showToast = (message: string) => {
    toast.textContent = message;
    toast.classList.add('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2000);
  };

  const renderMenuContent = async () => {
    menu.replaceChildren();

    const tagsSection = document.createElement('div');
    tagsSection.className = 'gff-section';

    const tagsTitle = document.createElement('div');
    tagsTitle.className = 'gff-section-title';
    tagsTitle.textContent = 'Tags';
    tagsSection.appendChild(tagsTitle);

    const currentTagsItem = activeMode === 'local' ? localTagsItem : tagsItem;
    const availableTags: Tag[] = (await currentTagsItem.getValue()) ?? [];
    if (availableTags.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.className = 'gff-empty-tags';
      emptyNotice.textContent = 'No tags created yet.';

      const openLib = document.createElement('button');
      openLib.type = 'button';
      openLib.className = 'gff-open-lib-btn';
      openLib.textContent = 'Open Library to add tags';
      openLib.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        window.open(browser.runtime.getURL('/library.html'), '_blank');
      });

      emptyNotice.appendChild(document.createElement('br'));
      emptyNotice.appendChild(openLib);
      tagsSection.appendChild(emptyNotice);
    } else {
      const tagList = document.createElement('div');
      tagList.className = 'gff-tag-list';

      for (const tag of availableTags) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'gff-tag-chip';

        if (tag.color) {
          const dot = document.createElement('span');
          dot.className = 'gff-tag-dot';
          dot.style.backgroundColor = tag.color;
          chip.appendChild(dot);
        }

        const nameSpan = document.createElement('span');
        nameSpan.textContent = tag.name;
        chip.appendChild(nameSpan);

        const isApplied = currentFavorite?.tags.includes(tag.id) ?? false;
        if (isApplied) chip.classList.add('active');

        chip.addEventListener('click', async (event) => {
          event.stopPropagation();
          event.preventDefault();

          let fav = currentFavorite;
          if (!fav) {
            fav = {
              id: fontId,
              family: options.family,
              addedAt: Date.now(),
              tags: [tag.id],
            };
            isFavorited = true;
            updateUI();
          } else {
            const hasTag = fav.tags.includes(tag.id);
            const nextTags = hasTag
              ? fav.tags.filter((t) => t !== tag.id)
              : [...fav.tags, tag.id];
            fav = { ...fav, tags: nextTags };
          }
          currentFavorite = fav;
          await favoriteItem.setValue(fav);
          renderMenuContent();
        });

        tagList.appendChild(chip);
      }
      tagsSection.appendChild(tagList);
    }
    menu.appendChild(tagsSection);

    const actions = document.createElement('div');
    actions.className = 'gff-actions';

    const createCopyButton = (label: string, format: string) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gff-action-btn';
      btn.textContent = label;

      btn.addEventListener('click', async (event) => {
        event.stopPropagation();
        event.preventDefault();

        const [settings, catalog] = await Promise.all([
          settingsItem.getValue(),
          options.catalog
            ? Promise.resolve(options.catalog)
            : catalogItem.getValue().then((c) => c?.fonts),
        ]);

        const fav: Favorite = currentFavorite ?? {
          id: fontId,
          family: options.family,
          addedAt: Date.now(),
          tags: [],
        };

        const context: SnippetContext = {
          favorites: [fav],
          settings,
          catalog,
        };

        let snippet = '';
        if (format === 'google-link') {
          snippet = buildGoogleLinkSnippet(context);
        } else if (format === 'google-import') {
          snippet = buildGoogleImportSnippet(context);
        } else if (format === 'fontsource') {
          snippet = buildFontsourceSnippet(context);
        }

        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(snippet);
        }

        showToast(`Copied ${label}!`);
        options.onCopied?.(format);
      });

      return btn;
    };

    actions.appendChild(createCopyButton('Google <link>', 'google-link'));
    actions.appendChild(createCopyButton('Google @import', 'google-import'));
    actions.appendChild(createCopyButton('Fontsource', 'fontsource'));

    menu.appendChild(actions);
  };

  const openMenu = () => {
    if (closeTimer) clearTimeout(closeTimer);
    renderMenuContent();
    menu.style.left = '';
    menu.style.right = '';
    menu.classList.add('visible');

    if (typeof window !== 'undefined') {
      const rect = menu.getBoundingClientRect();
      if (rect.width > 0 && rect.right > window.innerWidth - 8) {
        menu.style.left = 'auto';
        menu.style.right = '0';
      }
    }
  };

  const closeMenu = () => {
    if (openTimer) clearTimeout(openTimer);
    closeTimer = setTimeout(() => {
      menu.classList.remove('visible');
      menu.style.left = '';
      menu.style.right = '';
    }, 200);
  };

  host.addEventListener('mouseenter', () => {
    if (closeTimer) clearTimeout(closeTimer);
    openTimer = setTimeout(() => {
      openMenu();
    }, 200);
  });

  host.addEventListener('mouseleave', () => {
    closeMenu();
  });

  host.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openMenu();
  });

  const stopInteractions = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
  };

  const interactiveEvents = [
    'mousedown',
    'mouseup',
    'click',
    'pointerdown',
    'pointerup',
    'auxclick',
  ] as const;

  for (const eventName of interactiveEvents) {
    host.addEventListener(eventName, stopInteractions);
  }

  for (const eventName of [
    'mousedown',
    'mouseup',
    'pointerdown',
    'pointerup',
    'auxclick',
  ] as const) {
    button.addEventListener(eventName, (event) => {
      event.stopPropagation();
      event.preventDefault();
    });
  }

  button.addEventListener('click', async (event) => {
    event.stopPropagation();
    event.preventDefault();

    const nextState = !isFavorited;
    isFavorited = nextState;
    updateUI();

    try {
      if (nextState) {
        const fav: Favorite = {
          id: fontId,
          family: options.family,
          addedAt: Date.now(),
          tags: currentFavorite?.tags ?? [],
        };
        currentFavorite = fav;
        await favoriteItem.setValue(fav);
      } else {
        currentFavorite = null;
        await favoriteItem.removeValue();
      }
      options.onToggle?.(nextState);
    } catch {
      isFavorited = !nextState;
      updateUI();
    }
  });

  if (referenceNode && referenceNode.parentNode === container) {
    container.insertBefore(host, referenceNode);
  } else {
    container.appendChild(host);
  }

  return {
    unmount() {
      if (openTimer) clearTimeout(openTimer);
      if (closeTimer) clearTimeout(closeTimer);
      if (toastTimer) clearTimeout(toastTimer);
      unwatch();
      host.remove();
    },
  };
}
