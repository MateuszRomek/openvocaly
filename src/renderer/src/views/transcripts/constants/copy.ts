export const TRANSCRIPTS_COPY = {
  header: {
    title: 'Transcripts',
    description: 'Browse past dictations and copy any transcript in one click.'
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
    copy: 'Could not copy transcript text.'
  },
  actions: {
    copy: 'Copy',
    copied: 'Transcript copied.',
    retry: 'Try again',
    goToLastPage: 'Go to last page'
  },
  labels: {
    unknownApp: 'Unknown app',
    noLanguage: '—',
    noConfidence: '—',
    noDuration: '—'
  },
  pagination: {
    previous: 'Previous',
    next: 'Next',
    updating: 'Loading next page...'
  }
} as const
