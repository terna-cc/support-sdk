import { describe, it, expect } from 'vitest';
import { getTranslations, translations } from './translations';

describe('translations', () => {
  it('has English translations', () => {
    expect(translations['en']).toBeDefined();
    expect(translations['en'].triggerLabel).toBe('Report Issue');
    expect(translations['en'].modalTitle).toBe('Report Issue');
    expect(translations['en'].inputPlaceholder).toBe('Type your message...');
    expect(translations['en'].sendButton).toBe('Send');
    expect(translations['en'].submitButton).toBe('Submit');
    expect(translations['en'].keepChatting).toBe('Keep chatting');
    expect(translations['en'].categoryBug).toBe('Bug Report');
    expect(translations['en'].categoryFeedback).toBe('Feedback');
    expect(translations['en'].categoryFeature).toBe('Feature Request');
  });

  it('has Spanish translations', () => {
    expect(translations['es']).toBeDefined();
    expect(translations['es'].triggerLabel).toBe('Reportar problema');
    expect(translations['es'].modalTitle).toBe('Reportar problema');
    expect(translations['es'].inputPlaceholder).toBe('Escribe tu mensaje...');
    expect(translations['es'].sendButton).toBe('Enviar');
    expect(translations['es'].submitButton).toBe('Enviar');
    expect(translations['es'].keepChatting).toBe('Seguir conversando');
    expect(translations['es'].categoryBug).toBe('Reporte de error');
    expect(translations['es'].categoryFeedback).toBe('Comentario');
    expect(translations['es'].categoryFeature).toBe('Solicitud de funcionalidad');
  });
});

describe('getTranslations', () => {
  it('returns English for "en"', () => {
    const t = getTranslations('en');
    expect(t.triggerLabel).toBe('Report Issue');
  });

  it('returns Spanish for "es"', () => {
    const t = getTranslations('es');
    expect(t.triggerLabel).toBe('Reportar problema');
  });

  it('extracts language from locale with region (es-MX)', () => {
    const t = getTranslations('es-MX');
    expect(t.triggerLabel).toBe('Reportar problema');
  });

  it('extracts language from locale with region (en-US)', () => {
    const t = getTranslations('en-US');
    expect(t.triggerLabel).toBe('Report Issue');
  });

  it('falls back to English for unsupported locale', () => {
    const t = getTranslations('fr');
    expect(t.triggerLabel).toBe('Report Issue');
  });

  it('falls back to English for unknown locale with region', () => {
    const t = getTranslations('ja-JP');
    expect(t.triggerLabel).toBe('Report Issue');
  });

  it('returns all expected keys for English', () => {
    const t = getTranslations('en');
    expect(t).toHaveProperty('triggerLabel');
    expect(t).toHaveProperty('modalTitle');
    expect(t).toHaveProperty('inputPlaceholder');
    expect(t).toHaveProperty('sendButton');
    expect(t).toHaveProperty('submitButton');
    expect(t).toHaveProperty('keepChatting');
    expect(t).toHaveProperty('summaryTitle');
    expect(t).toHaveProperty('categoryBug');
    expect(t).toHaveProperty('categoryFeedback');
    expect(t).toHaveProperty('categoryFeature');
    expect(t).toHaveProperty('stepsToReproduce');
    expect(t).toHaveProperty('expectedBehavior');
    expect(t).toHaveProperty('actualBehavior');
    expect(t).toHaveProperty('severity');
    expect(t).toHaveProperty('submitting');
    expect(t).toHaveProperty('submitFailed');
  });

  it('returns all expected keys for Spanish', () => {
    const t = getTranslations('es');
    expect(t).toHaveProperty('triggerLabel');
    expect(t).toHaveProperty('modalTitle');
    expect(t).toHaveProperty('inputPlaceholder');
    expect(t).toHaveProperty('sendButton');
    expect(t).toHaveProperty('submitButton');
    expect(t).toHaveProperty('keepChatting');
    expect(t).toHaveProperty('summaryTitle');
    expect(t).toHaveProperty('categoryBug');
    expect(t).toHaveProperty('categoryFeedback');
    expect(t).toHaveProperty('categoryFeature');
    expect(t).toHaveProperty('stepsToReproduce');
    expect(t).toHaveProperty('expectedBehavior');
    expect(t).toHaveProperty('actualBehavior');
    expect(t).toHaveProperty('severity');
    expect(t).toHaveProperty('submitting');
    expect(t).toHaveProperty('submitFailed');
  });
});
