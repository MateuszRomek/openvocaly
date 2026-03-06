export const MODELS_COPY = {
  errors: {
    loadSettings: 'Could not load transcription settings. Try again.',
    saveProviderSettings: 'Could not save provider settings. Try again.',
    removeApiKey: 'Could not remove API key. Try again.',
    saveApiKey: 'Could not save API key. Try again.'
  },
  local: {
    title: 'Local models',
    description: 'Choose a local provider, download a model, and run transcription on this device.'
  },
  providers: {
    unavailableDescription: 'This provider is coming soon in OpenVocally.'
  }
} as const
