import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTriggerButton } from './trigger';
import type { TriggerConfig } from './trigger';

describe('createTriggerButton', () => {
  let defaultConfig: TriggerConfig;

  beforeEach(() => {
    defaultConfig = {
      position: 'bottom-right',
      label: 'Report Issue',
      primaryColor: '#2563eb',
      onClick: vi.fn(),
    };
  });

  afterEach(() => {
    // Clean up any mounted triggers
    document
      .querySelectorAll('[data-support-trigger]')
      .forEach((el) => el.remove());
  });

  it('mounts a host element with Shadow DOM to document.body', () => {
    const trigger = createTriggerButton(defaultConfig);
    trigger.mount();

    const host = document.querySelector('[data-support-trigger]');
    expect(host).not.toBeNull();
    expect(host!.shadowRoot).not.toBeNull();
  });

  it('renders a button inside Shadow DOM', () => {
    const trigger = createTriggerButton(defaultConfig);
    trigger.mount();

    const host = document.querySelector('[data-support-trigger]');
    const button = host!.shadowRoot!.querySelector('button');
    expect(button).not.toBeNull();
    expect(button!.getAttribute('aria-label')).toBe('Report Issue');
  });

  it('renders label text', () => {
    const trigger = createTriggerButton(defaultConfig);
    trigger.mount();

    const host = document.querySelector('[data-support-trigger]');
    const label = host!.shadowRoot!.querySelector('.trigger-label');
    expect(label).not.toBeNull();
    expect(label!.textContent).toBe('Report Issue');
  });

  it('fires onClick callback when clicked', () => {
    const trigger = createTriggerButton(defaultConfig);
    trigger.mount();

    const host = document.querySelector('[data-support-trigger]');
    const button = host!.shadowRoot!.querySelector('button')!;
    button.click();

    expect(defaultConfig.onClick).toHaveBeenCalledTimes(1);
  });

  it('applies correct position class', () => {
    for (const position of [
      'bottom-right',
      'bottom-left',
      'top-right',
      'top-left',
    ] as const) {
      const config = { ...defaultConfig, position };
      const trigger = createTriggerButton(config);
      trigger.mount();

      const hosts = document.querySelectorAll('[data-support-trigger]');
      const host = hosts[hosts.length - 1];
      const button = host.shadowRoot!.querySelector('button')!;
      expect(button.classList.contains(position)).toBe(true);

      trigger.unmount();
    }
  });

  it('show() removes hidden class', () => {
    const trigger = createTriggerButton(defaultConfig);
    trigger.mount();
    trigger.hide();

    const host = document.querySelector('[data-support-trigger]');
    const button = host!.shadowRoot!.querySelector('button')!;
    expect(button.classList.contains('hidden')).toBe(true);

    trigger.show();
    expect(button.classList.contains('hidden')).toBe(false);
  });

  it('hide() adds hidden class', () => {
    const trigger = createTriggerButton(defaultConfig);
    trigger.mount();
    trigger.hide();

    const host = document.querySelector('[data-support-trigger]');
    const button = host!.shadowRoot!.querySelector('button')!;
    expect(button.classList.contains('hidden')).toBe(true);
  });

  it('unmount() removes host from DOM', () => {
    const trigger = createTriggerButton(defaultConfig);
    trigger.mount();

    expect(document.querySelector('[data-support-trigger]')).not.toBeNull();

    trigger.unmount();

    expect(document.querySelector('[data-support-trigger]')).toBeNull();
  });

  it('does not mount twice if mount() is called again', () => {
    const trigger = createTriggerButton(defaultConfig);
    trigger.mount();
    trigger.mount();

    const hosts = document.querySelectorAll('[data-support-trigger]');
    expect(hosts.length).toBe(1);
  });

  it('injects styles into Shadow DOM', () => {
    const trigger = createTriggerButton(defaultConfig);
    trigger.mount();

    const host = document.querySelector('[data-support-trigger]');
    const style = host!.shadowRoot!.querySelector('style');
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain('.trigger-btn');
  });

  it('applies custom primary color via theme config in CSS', () => {
    const config = {
      ...defaultConfig,
      theme: { primaryColor: '#ff0000' },
    };
    const trigger = createTriggerButton(config);
    trigger.mount();

    const host = document.querySelector('[data-support-trigger]');
    const style = host!.shadowRoot!.querySelector('style');
    expect(style!.textContent).toContain('--support-primary-color: #ff0000');
  });

  it('renders default SVG icon when no triggerIcon is provided', () => {
    const trigger = createTriggerButton(defaultConfig);
    trigger.mount();

    const host = document.querySelector('[data-support-trigger]');
    const svg = host!.shadowRoot!.querySelector('svg');
    expect(svg).not.toBeNull();
    // No <img> element should exist
    const img = host!.shadowRoot!.querySelector('img');
    expect(img).toBeNull();
  });

  it('renders custom icon image when triggerIcon is provided in theme', () => {
    const config = {
      ...defaultConfig,
      theme: { triggerIcon: 'https://example.com/icon.svg' },
    };
    const trigger = createTriggerButton(config);
    trigger.mount();

    const host = document.querySelector('[data-support-trigger]');
    const img = host!.shadowRoot!.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.src).toBe('https://example.com/icon.svg');
    expect(img!.alt).toBe('Support');

    // Default SVG icon should not be present
    const svgInSpan = host!.shadowRoot!.querySelector('.trigger-icon svg');
    expect(svgInSpan).toBeNull();
  });

  it('includes theme CSS vars in styles when theme is provided', () => {
    const config = {
      ...defaultConfig,
      theme: {
        primaryColor: '#e11d48',
        fontFamily: '"Inter", sans-serif',
        triggerSize: '56px',
      },
    };
    const trigger = createTriggerButton(config);
    trigger.mount();

    const host = document.querySelector('[data-support-trigger]');
    const style = host!.shadowRoot!.querySelector('style');
    const css = style!.textContent!;

    expect(css).toContain('--support-primary-color: #e11d48');
    expect(css).toContain('--support-font: "Inter", sans-serif');
    expect(css).toContain('--support-trigger-size: 56px');
  });
});
