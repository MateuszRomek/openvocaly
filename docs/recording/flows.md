# Recording Runtime Flows

## 1) Start -> stop -> artifact handoff

```mermaid
sequenceDiagram
  participant DP as Dictation Pipeline (main)
  participant R as Recording Orchestrator (main)
  participant C as Capture Runtime (main)
  participant CR as Capture Renderer (renderer)
  participant A as Artifact Store (main)
  participant B as Recording Artifact Bus (main)

  DP->>R: startRecording(mode)
  R->>A: createActiveArtifact()
  R->>C: sendCommand(start)
  C->>CR: recording:capture-command(start)
  CR-->>C: started(sessionId)
  C-->>R: recording:capture-event(started)
  CR-->>C: chunk/meter events
  C-->>R: recording:capture-event(chunk/meter)
  R->>A: writeChunk(...)

  DP->>R: stopRecording()
  R->>C: sendCommand(stop)
  CR-->>C: stopped(durationMs)
  C-->>R: recording:capture-event(stopped)
  R->>A: finalize(durationMs)
  R->>B: emit(artifact)
```

## 2) Cancel during active capture

```mermaid
sequenceDiagram
  participant DP as Dictation Pipeline
  participant R as Recording Orchestrator
  participant C as Capture Runtime
  participant CR as Capture Renderer
  participant A as Artifact Store

  DP->>R: cancelRecording()
  R->>C: sendCommand(cancel, reason=aborted)
  C->>CR: recording:capture-command(cancel)
  CR-->>C: error(reason=aborted)
  C-->>R: recording:capture-event(error)
  R->>A: abort writer (best effort)
  R->>A: markFailure(reason=aborted)
```

## 3) Capture failure behavior

- Any capture write/finalize/runtime error maps to `capture_error` unless explicit `aborted`.
- Failure artifact metadata is persisted on capture failure paths (best effort).
- Recording state snapshots are emitted for pipeline consumers.

## 4) App shutdown during active recording

1. Shutdown aborts any active writer.
2. Active artifact is persisted as failed (`aborted`, `Application shutdown.`).
3. Capture runtime is torn down.
