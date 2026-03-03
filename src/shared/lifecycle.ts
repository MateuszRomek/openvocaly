export type ActiveCapturePhase = 'starting' | 'recording' | 'stopping'

export type TerminalPhase = 'complete' | 'failed'

export const isActiveCapturePhase = (phase: string): phase is ActiveCapturePhase =>
  phase === 'starting' || phase === 'recording' || phase === 'stopping'

export const isIdlePhase = (phase: string): phase is 'idle' => phase === 'idle'

export const isTerminalPhase = (phase: string): phase is TerminalPhase =>
  phase === 'complete' || phase === 'failed'
