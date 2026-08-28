export const TRANSCRIPTS_COPY = {
  header: {
    title: 'Transcripts',
    description: 'Your recent dictation, ready to copy.'
  },
  empty: {
    title: 'No transcripts yet',
    description: 'Start dictating to see your transcript history here.'
  },
  emptyPage: {
    title: 'This page has no transcripts',
    description: 'Try returning to the last available page.'
  },
  errors: {
    load: 'Could not load transcripts. Try again.',
    copy: 'Could not copy transcript text.',
    description: 'We could not load transcript history. Check again in a moment.'
  },
  actions: {
    copyTranscript: 'Copy transcript',
    copied: 'Transcript copied.',
    retry: 'Try again',
    goToLastPage: 'Go to last page'
  },
  labels: {
    unknownApp: 'Unknown app',
    emptyTranscript: 'This transcript is empty.',
    noLanguage: '—',
    noConfidence: '—',
    noDuration: '—',
    transcript: 'Transcript',
    language: 'Language',
    confidence: 'Confidence',
    duration: 'Duration',
    app: 'App'
  },
  pagination: {
    previous: 'Previous',
    next: 'Next',
    updating: 'Updating transcript history…',
    label: 'Transcript pages'
  }
} as const
