import { browser } from 'wxt/browser';
import { familyNameToFontId } from '../../src/core/family-id';
import { buildSnippet } from '../../src/core/snippets';
import type {
  CatalogFont,
  Favorite,
  Settings,
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
import { copyText } from '../../src/ui/clipboard';
import { STYLES } from './heart-styles';

export interface HeartMountOptions {
  family: string;
  catalog?: CatalogFont[];
  isFavorited?: boolean;
  onToggle?: (isFavorited: boolean) => void;
  onCopied?: (format: string) => void;
}

export interface MountedHeart {
  host: HTMLElement;
  unmount: () => void;
}

const HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

export function mountHeartButton(
  container: HTMLElement,
  options: HeartMountOptions,
  referenceNode?: Node | null,
): MountedHeart {
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
  button.setAttribute('aria-haspopup', 'true');

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
  toast.setAttribute('role', 'status');
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

  const watchFavoriteItem = () =>
    favoriteItem.watch((newVal) => {
      currentFavorite = newVal;
      isFavorited = Boolean(newVal);
      updateUI();
    });

  let unwatch = watchFavoriteItem();

  const syncFavoriteState = async () => {
    const settings = await settingsItem.getValue();
    const mode = settings?.storageMode ?? 'sync';
    if (mode !== activeMode) {
      activeMode = mode;
      unwatch();
      favoriteItem = defineFavoriteItem(fontId, activeMode);
      unwatch = watchFavoriteItem();
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
        browser.runtime.sendMessage({ type: 'open-library' }).catch((error) => {
          console.error('Failed to open library from content script:', error);
        });
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
        chip.setAttribute('aria-pressed', String(isApplied));

        chip.addEventListener('click', async (event) => {
          event.stopPropagation();
          event.preventDefault();

          const previousFavorite = currentFavorite;
          const previousIsFavorited = isFavorited;
          const nextFavorite: Favorite = previousFavorite
            ? {
                ...previousFavorite,
                tags: previousFavorite.tags.includes(tag.id)
                  ? previousFavorite.tags.filter((t) => t !== tag.id)
                  : [...previousFavorite.tags, tag.id],
              }
            : {
                id: fontId,
                family: options.family,
                addedAt: Date.now(),
                tags: [tag.id],
              };

          currentFavorite = nextFavorite;
          isFavorited = true;
          updateUI();
          const nowApplied = nextFavorite.tags.includes(tag.id);
          chip.classList.toggle('active', nowApplied);
          chip.setAttribute('aria-pressed', String(nowApplied));

          try {
            await favoriteItem.setValue(nextFavorite);
          } catch {
            currentFavorite = previousFavorite;
            isFavorited = previousIsFavorited;
            updateUI();
            chip.classList.toggle('active', !nowApplied);
            chip.setAttribute('aria-pressed', String(!nowApplied));
            showToast("Couldn't save. Storage may be full.");
          }
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

        const snippet = buildSnippet({
          favorites: [fav],
          settings: {
            ...settings,
            copyFormat: format as Settings['copyFormat'],
          },
          catalog,
        });

        if (!(await copyText(snippet))) {
          showToast('Copy failed');
          return;
        }

        showToast(`Copied ${label}!`);
        options.onCopied?.(format);
      });

      return btn;
    };

    actions.appendChild(createCopyButton('Google <link>', 'google-link'));
    actions.appendChild(createCopyButton('Google @import', 'google-import'));
    actions.appendChild(createCopyButton('Fontsource', 'fontsource'));
    actions.appendChild(createCopyButton('Tailwind v4', 'tailwind-v4'));
    actions.appendChild(createCopyButton('Next.js', 'next-font'));

    menu.appendChild(actions);
  };

  const isMenuOpen = () => menu.classList.contains('visible');

  const openMenu = () => {
    if (closeTimer) clearTimeout(closeTimer);
    void renderMenuContent();
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

  const hideMenu = () => {
    menu.classList.remove('visible');
    menu.style.left = '';
    menu.style.right = '';
  };

  const closeMenu = () => {
    if (openTimer) clearTimeout(openTimer);
    closeTimer = setTimeout(hideMenu, 200);
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

  host.addEventListener('focusin', () => {
    if (closeTimer) clearTimeout(closeTimer);
    if (!isMenuOpen()) openMenu();
  });

  host.addEventListener('focusout', () => {
    closeMenu();
  });

  host.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isMenuOpen()) {
      event.stopPropagation();
      hideMenu();
    }
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

    const previousFavorite = currentFavorite;
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
      currentFavorite = previousFavorite;
      updateUI();
      showToast("Couldn't save. Storage may be full.");
    }
  });

  if (referenceNode && referenceNode.parentNode === container) {
    container.insertBefore(host, referenceNode);
  } else {
    container.appendChild(host);
  }

  return {
    host,
    unmount() {
      if (openTimer) clearTimeout(openTimer);
      if (closeTimer) clearTimeout(closeTimer);
      if (toastTimer) clearTimeout(toastTimer);
      unwatch();
      host.remove();
    },
  };
}
