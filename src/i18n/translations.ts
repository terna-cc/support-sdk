export interface Translations {
  triggerLabel: string;
  modalTitle: string;
  inputPlaceholder: string;
  sendButton: string;
  submitButton: string;
  keepChatting: string;
  summaryTitle: string;
  categoryBug: string;
  categoryFeedback: string;
  categoryFeature: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  severity: string;
  submitting: string;
  submitFailed: string;
}

export const translations: Record<string, Translations> = {
  en: {
    triggerLabel: 'Help',
    modalTitle: 'Help Center',
    inputPlaceholder: 'Ask a question or report an issue...',
    sendButton: 'Send',
    submitButton: 'Submit',
    keepChatting: 'Keep chatting',
    summaryTitle: 'Summary',
    categoryBug: 'Bug Report',
    categoryFeedback: 'Feedback',
    categoryFeature: 'Feature Request',
    stepsToReproduce: 'Steps to Reproduce',
    expectedBehavior: 'Expected Behavior',
    actualBehavior: 'Actual Behavior',
    severity: 'Severity',
    submitting: 'Submitting...',
    submitFailed: 'Failed to submit report',
  },
  es: {
    triggerLabel: 'Ayuda',
    modalTitle: 'Centro de ayuda',
    inputPlaceholder: 'Haz una pregunta o reporta un problema...',
    sendButton: 'Enviar',
    submitButton: 'Enviar',
    keepChatting: 'Seguir conversando',
    summaryTitle: 'Resumen',
    categoryBug: 'Reporte de error',
    categoryFeedback: 'Comentario',
    categoryFeature: 'Solicitud de funcionalidad',
    stepsToReproduce: 'Pasos para reproducir',
    expectedBehavior: 'Comportamiento esperado',
    actualBehavior: 'Comportamiento actual',
    severity: 'Severidad',
    submitting: 'Enviando...',
    submitFailed: 'Error al enviar el reporte',
  },
};

export function getTranslations(locale: string): Translations {
  const lang = locale.split('-')[0];
  return translations[lang] ?? translations['en'];
}
