import { describe, it, expect } from 'vitest';
import { buildThemeVars } from './styles';

describe('buildThemeVars', () => {
  it('returns default CSS custom properties when no theme is provided', () => {
    const css = buildThemeVars();

    expect(css).toContain('--support-primary-color: #2563eb');
    expect(css).toContain('--support-primary-text: #ffffff');
    expect(css).toContain('--support-primary-hover: #1d4ed8');
    expect(css).toContain('--support-bg: #ffffff');
    expect(css).toContain("--support-text: #1e293b");
    expect(css).toContain("--support-text-secondary: #64748b");
    expect(css).toContain('--support-assistant-bubble: #f3f4f6');
    expect(css).toContain('--support-border: #e2e8f0');
    expect(css).toContain('--support-radius: 8px');
    expect(css).toContain('--support-font-size: 14px');
    expect(css).toContain('--support-trigger-size: 48px');
    expect(css).toContain('--support-panel-width: 380px');
    expect(css).toContain('--support-panel-max-height: 520px');
    expect(css).toContain('-apple-system');
  });

  it('returns default CSS custom properties when empty theme is provided', () => {
    const css = buildThemeVars({});

    expect(css).toContain('--support-primary-color: #2563eb');
    expect(css).toContain('--support-primary-text: #ffffff');
  });

  it('overrides primaryColor', () => {
    const css = buildThemeVars({ primaryColor: '#ff0000' });

    expect(css).toContain('--support-primary-color: #ff0000');
    // Should also compute a darker hover color
    expect(css).not.toContain('--support-primary-hover: #1d4ed8');
  });

  it('overrides primaryTextColor', () => {
    const css = buildThemeVars({ primaryTextColor: '#000000' });
    expect(css).toContain('--support-primary-text: #000000');
  });

  it('overrides backgroundColor', () => {
    const css = buildThemeVars({ backgroundColor: '#1a1a2e' });
    expect(css).toContain('--support-bg: #1a1a2e');
  });

  it('overrides textColor', () => {
    const css = buildThemeVars({ textColor: '#333333' });
    expect(css).toContain('--support-text: #333333');
  });

  it('overrides subtextColor', () => {
    const css = buildThemeVars({ subtextColor: '#999999' });
    expect(css).toContain('--support-text-secondary: #999999');
  });

  it('overrides assistantBubbleColor', () => {
    const css = buildThemeVars({ assistantBubbleColor: '#e8e8e8' });
    expect(css).toContain('--support-assistant-bubble: #e8e8e8');
  });

  it('overrides borderColor', () => {
    const css = buildThemeVars({ borderColor: '#cccccc' });
    expect(css).toContain('--support-border: #cccccc');
  });

  it('overrides fontFamily', () => {
    const css = buildThemeVars({ fontFamily: '"Inter", sans-serif' });
    expect(css).toContain('--support-font: "Inter", sans-serif');
  });

  it('overrides fontSize', () => {
    const css = buildThemeVars({ fontSize: '16px' });
    expect(css).toContain('--support-font-size: 16px');
  });

  it('overrides triggerSize', () => {
    const css = buildThemeVars({ triggerSize: '56px' });
    expect(css).toContain('--support-trigger-size: 56px');
  });

  it('overrides borderRadius', () => {
    const css = buildThemeVars({ borderRadius: '16px' });
    expect(css).toContain('--support-radius: 16px');
  });

  it('overrides panelWidth', () => {
    const css = buildThemeVars({ panelWidth: '420px' });
    expect(css).toContain('--support-panel-width: 420px');
  });

  it('overrides panelMaxHeight', () => {
    const css = buildThemeVars({ panelMaxHeight: '600px' });
    expect(css).toContain('--support-panel-max-height: 600px');
  });

  it('applies multiple overrides simultaneously', () => {
    const css = buildThemeVars({
      primaryColor: '#e11d48',
      backgroundColor: '#0f172a',
      textColor: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '13px',
      panelWidth: '400px',
    });

    expect(css).toContain('--support-primary-color: #e11d48');
    expect(css).toContain('--support-bg: #0f172a');
    expect(css).toContain('--support-text: #f8fafc');
    expect(css).toContain('--support-font: monospace');
    expect(css).toContain('--support-font-size: 13px');
    expect(css).toContain('--support-panel-width: 400px');
    // Non-overridden values should retain defaults
    expect(css).toContain('--support-border: #e2e8f0');
  });

  it('wraps CSS vars in :host selector', () => {
    const css = buildThemeVars();
    expect(css).toContain(':host {');
  });

  it('computes a darker hover color from custom primaryColor', () => {
    const css = buildThemeVars({ primaryColor: '#ffffff' });
    // #ffffff darkened by 30 per channel = #e1e1e1
    expect(css).toContain('--support-primary-hover: #e1e1e1');
  });

  it('handles very dark primary colors without going below 0', () => {
    const css = buildThemeVars({ primaryColor: '#0a0a0a' });
    // Each channel: 10 - 30 = clamped to 0
    expect(css).toContain('--support-primary-hover: #000000');
  });
});
