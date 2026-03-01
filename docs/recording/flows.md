# Recording Runtime Flows

## 1) Toggle start -> stop -> transcription success

```mermaid
sequenceDiagram
  participant U as User
  participant S as Shortcut Service (main)
  participant B as Recording Command Bus (main)
  participant O as Orchestrator (main)
  participant C as Capture Runtime (main)
  participant R as Capture Renderer (renderer)
  participant A as Artifact Store (main)
  participant T as Transcription Provider (main)
  participant P as Overlay Publisher/Controller

  U->>S: toggle shortcut
  S->>B: emit(toggle)
  B->>O: command toggle
  O->>A: createActiveArtifact()
  O->>P: publish phase=starting
  O->>C: sendCommand(start, sessionId, soundCues)
  C->>R: recording:capture-command(start)
  R-->>C: started(sessionId)
  C-->>O: recording:capture-event(started)
  O->>P: publish phase=recording
  R-->>C: chunk/meter events
  C-->>O: recording:capture-event(chunk/meter)
  O->>A: writeChunk(...)
  O->>P: publish audio levels (throttled)

  U->>S: toggle shortcut
  S->>B: emit(toggle)
  B->>O: command toggle
  O->>P: publish phase=stopping
  O->>C: sendCommand(stop)
  R-->>C: stopped(durationMs)
  C-->>O: recording:capture-event(stopped)
  O->>A: finalize(durationMs)
  O->>T: transcribe(artifact)
  T-->>O: ok
  O->>A: markTranscriptionSuccess()
  O->>P: publish phase=complete
  O->>O: schedule idle reset
  O->>P: publish null (hide overlay)
```

## 2) Cancel during starting/recording/stopping

```mermaid
sequenceDiagram
  participant U as User
  participant S as Shortcut Service
  participant O as Orchestrator
  participant C as Capture Runtime
  participant R as Capture Renderer
  participant A as Artifact Store
  participant P as Overlay Publisher

  U->>S: cancel shortcut (default Escape)
  S->>O: command cancel
  O->>C: sendCommand(cancel, reason=aborted, soundCues)
  C->>R: recording:capture-command(cancel)
  R-->>C: error(reason=aborted)
  C-->>O: recording:capture-event(error)
  O->>A: abort active writer (best effort)
  O->>A: markFailure(reason=aborted)
  O->>P: publish phase=failed(reason=aborted)
  O->>O: schedule short idle reset
  O->>P: hide overlay
```

## 3) Push-to-talk hold/release

```mermaid
sequenceDiagram
  participant U as User
  participant PTT as Native PTT Hook
  participant S as Shortcut Service/PTT Manager
  participant O as Orchestrator

  U->>PTT: hold PTT key
  PTT->>S: push_to_talk_start
  S->>O: command push_to_talk_start
  O->>O: begin recording (mode=push_to_talk)

  U->>PTT: release PTT key
  PTT->>S: push_to_talk_stop
  S->>O: command push_to_talk_stop
  O->>O: stop recording
```

## 4) Capture/transcription failure behavior

- Any capture write/finalize/runtime error maps to `capture_error` unless explicit `aborted`.
- Thrown transcription exceptions are normalized to `transcription_error`.
- Artifact failure metadata is persisted on failure paths (best effort).
- Terminal failed state is always published before idle reset.

## 5) App shutdown during active recording

1. `before-quit` triggers graceful shutdown sequence.
2. `shutdownRecording()` is awaited with timeout (`2500ms`).
3. Active artifact is aborted and persisted as failed (`aborted`, message `Application shutdown.`).
4. Overlay/capture runtimes are destroyed.
5. App continues quit even if timeout path is reached.
