import { triggerStyles, buildThemeVars } from './styles';
import type { ThemeConfig } from '../types';

export interface TriggerConfig {
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  label: string;
  primaryColor: string;
  theme?: ThemeConfig;
  onClick: () => void;
}

export interface TriggerButton {
  mount(): void;
  unmount(): void;
  show(): void;
  hide(): void;
}

export function createTriggerButton(config: TriggerConfig): TriggerButton {
  let host: HTMLDivElement | null = null;
  let shadow: ShadowRoot | null = null;
  let button: HTMLButtonElement | null = null;

  function mount(): void {
    if (host) return;

    host = document.createElement('div');
    host.setAttribute('data-support-trigger', '');
    shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = buildThemeVars(config.theme) + triggerStyles;
    shadow.appendChild(style);

    button = document.createElement('button');
    button.className = `trigger-btn ${config.position}`;
    button.type = 'button';
    button.setAttribute('aria-label', config.label);

    // Custom trigger icon or default SVG
    if (config.theme?.triggerIcon) {
      const img = document.createElement('img');
      img.src = config.theme.triggerIcon;
      img.alt = 'Support';
      img.className = 'trigger-icon';
      img.style.cssText = 'width: 24px; height: 24px;';
      button.appendChild(img);
    } else {
      const icon = document.createElement('span');
      icon.className = 'trigger-icon';
      icon.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg',
      );
      svg.setAttribute('viewBox', '0 0 16 16');
      svg.setAttribute('fill', 'currentColor');
      svg.setAttribute('width', '16');
      svg.setAttribute('height', '16');
      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path',
      );
      path.setAttribute(
        'd',
        'M8 1a3 3 0 0 0-3 3v1H4a1 1 0 0 0-1 1v1H1.5a.5.5 0 0 0 0 1H3v1.5H1.5a.5.5 0 0 0 0 1H3V12a5 5 0 0 0 10 0V10.5h1.5a.5.5 0 0 0 0-1H13V8h1.5a.5.5 0 0 0 0-1H13V6a1 1 0 0 0-1-1h-1V4a3 3 0 0 0-3-3zm2 4H6V4a2 2 0 1 1 4 0v1zM4 7h8v5a4 4 0 0 1-8 0V7z',
      );
      svg.appendChild(path);
      icon.appendChild(svg);
      button.appendChild(icon);
    }

    // Label text
    const label = document.createElement('span');
    label.className = 'trigger-label';
    label.textContent = config.label;
    button.appendChild(label);

    button.addEventListener('click', config.onClick);
    shadow.appendChild(button);
    document.body.appendChild(host);
  }

  function unmount(): void {
    if (host) {
      host.remove();
      host = null;
      shadow = null;
      button = null;
    }
  }

  function show(): void {
    if (button) {
      button.classList.remove('hidden');
    }
  }

  function hide(): void {
    if (button) {
      button.classList.add('hidden');
    }
  }

  return { mount, unmount, show, hide };
}
