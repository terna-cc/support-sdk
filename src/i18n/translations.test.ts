import { describe, it, expect } from 'vitest';
import { getTranslations, translations } from './translations';

describe('translations', () => {
  it('has English translations', () => {
    expect(translations['en']).toBeDefined();
    expect(translations['en'].triggerLabel).toBe('Help');
    expect(translations['en'].modalTitle).toBe('Help Center');
    expect(translations['en'].inputPlaceholder).toBe(
      'Ask a question or report an issue...',
    );
    expect(translations['en'].sendButton).toBe('Send');
    expect(translations['en'].submitButton).toBe('Submit');
    expect(translations['en'].keepChatting).toBe('Keep chatting');
    expect(translations['en'].categoryBug).toBe('Bug Report');
    expect(translations['en'].categoryFeedback).toBe('Feedback');
    expect(translations['en'].categoryFeature).toBe('Feature Request');
    expect(translations['en'].errorMessage).toBe(
      'There was a problem processing your message. Please try again.',
    );
    expect(translations['en'].retryButton).toBe('Try again');
  });

  it('has Spanish translations', () => {
    expect(translations['es']).toBeDefined();
    expect(translations['es'].triggerLabel).toBe('Ayuda');
    expect(translations['es'].modalTitle).toBe('Centro de ayuda');
    expect(translations['es'].inputPlaceholder).toBe(
      'Haz una pregunta o reporta un problema...',
    );
    expect(translations['es'].sendButton).toBe('Enviar');
    expect(translations['es'].submitButton).toBe('Enviar');
    expect(translations['es'].keepChatting).toBe('Seguir conversando');
    expect(translations['es'].categoryBug).toBe('Reporte de error');
    expect(translations['es'].categoryFeedback).toBe('Comentario');
    expect(translations['es'].categoryFeature).toBe(
      'Solicitud de funcionalidad',
    );
    expect(translations['es'].errorMessage).toBe(
      'Hubo un problema al procesar tu mensaje. Por favor intenta de nuevo.',
    );
    expect(translations['es'].retryButton).toBe('Intentar de nuevo');
  });
});

describe('getTranslations', () => {
  it('returns English for "en"', () => {
    const t = getTranslations('en');
    expect(t.triggerLabel).toBe('Help');
  });

  it('returns Spanish for "es"', () => {
    const t = getTranslations('es');
    expect(t.triggerLabel).toBe('Ayuda');
  });

  it('extracts language from locale with region (es-MX)', () => {
    const t = getTranslations('es-MX');
    expect(t.triggerLabel).toBe('Ayuda');
  });

  it('extracts language from locale with region (en-US)', () => {
    const t = getTranslations('en-US');
    expect(t.triggerLabel).toBe('Help');
  });

  it('falls back to English for unsupported locale', () => {
    const t = getTranslations('fr');
    expect(t.triggerLabel).toBe('Help');
  });

  it('falls back to English for unknown locale with region', () => {
    const t = getTranslations('ja-JP');
    expect(t.triggerLabel).toBe('Help');
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
    expect(t).toHaveProperty('errorMessage');
    expect(t).toHaveProperty('retryButton');
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
    expect(t).toHaveProperty('errorMessage');
    expect(t).toHaveProperty('retryButton');
  });
});
