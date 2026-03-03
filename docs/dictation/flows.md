# Dictation Runtime Flows

## 1) Toggle start -> stop -> transcription success

```mermaid
sequenceDiagram
  participant U as User
  participant S as Shortcut Service
  participant B as Recording Command Bus
  participant D as Dictation Pipeline Orchestrator
  participant R as Recording Orchestrator
  participant A as Recording Artifact Bus
  participant T as Transcription Service
  participant O as Overlay Publisher

  U->>S: toggle shortcut
  S->>B: emit(toggle)
  B->>D: command toggle
  D->>R: startRecording(toggle)
  R-->>D: session snapshots (starting/recording + meter)
  D->>O: publish starting/recording

  U->>S: toggle shortcut
  S->>B: emit(toggle)
  B->>D: command toggle
  D->>R: stopRecording()
  R-->>A: emit(artifact)
  R-->>D: session snapshot complete
  D->>O: publish transcribing

  A-->>D: artifact
  D->>D: delegate transcription workflow
  D->>T: transcribeArtifact(artifact)
  T-->>D: workflow result = complete
  D->>O: publish complete
  D->>D: resolve terminal delay policy + schedule idle reset
  D->>O: publish null
```

## 2) Transcription failure

```mermaid
sequenceDiagram
  participant D as Dictation Pipeline
  participant T as Transcription Service
  participant AS as Artifact Store
  participant R as Recording Orchestrator
  participant O as Overlay Publisher

  D->>D: delegate transcription workflow
  D->>T: transcribeArtifact(artifact)
  T-->>D: workflow result = failed(transcription_error)
  D->>AS: persist failure artifact
  D->>R: playCue(error)
  D->>O: publish failed(transcription_error)
  D->>D: resolve failure delay policy + schedule idle reset
  D->>O: publish null
```

## 3) Capture failure

- Recording orchestrator emits failed snapshot with recording-domain reason.
- Dictation pipeline maps it to top-level failed state.
- Dictation terminal timer policy applies, then state resets to idle.

## 4) Single-session gating

- While phase is `transcribing`, `complete`, or `failed` (pre-reset), begin commands are ignored.
- New recording can start only after top-level state returns to `idle`.
