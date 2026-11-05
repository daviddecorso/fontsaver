export interface HeartMountOptions {
  family: string;
  isFavorited?: boolean;
  onToggle?: (isFavorited: boolean) => void;
}

export function mountHeartButton(
  container: HTMLElement,
  options: HeartMountOptions,
): { unmount: () => void } {
  const host = document.createElement('span');
  host.setAttribute('data-gff-heart', options.family);
  const shadow = host.attachShadow({ mode: 'open' });

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', `Favorite ${options.family}`);
  button.textContent = options.isFavorited ? '♥' : '♡';

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    event.preventDefault();
    options.onToggle?.(!options.isFavorited);
  });

  shadow.appendChild(button);
  container.appendChild(host);

  return {
    unmount() {
      host.remove();
    },
  };
}
