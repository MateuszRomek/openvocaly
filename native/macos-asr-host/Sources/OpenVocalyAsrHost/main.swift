import FluidAudio
import Foundation

private struct HostRequest: Decodable {
  let id: String
  let command: String
  let modelDirectory: String?
  let filePath: String?
}

private struct HostResponse: Encodable {
  let id: String
  let ok: Bool
  let event: String?
  let percentage: Int?
  let text: String?
  let confidence: Float?
  let durationMs: Int?
  let error: String?
}

private actor ParakeetEngine {
  private let modelRepositoryName = "parakeet-tdt-0.6b-v3"
  private var manager: AsrManager?
  private var loadedModelDirectory: URL?

  func handle(
    _ request: HostRequest,
    reportProgress: @escaping @Sendable (Double) -> Void
  ) async -> HostResponse {
    do {
      switch request.command {
      case "install":
        let directory = try requiredDirectory(from: request)
        try await install(into: directory, reportProgress: reportProgress)
        return HostResponse(id: request.id, ok: true, event: nil, percentage: nil, text: nil, confidence: nil, durationMs: nil, error: nil)
      case "warm":
        let directory = try requiredDirectory(from: request)
        try await warm(directory: directory)
        return HostResponse(id: request.id, ok: true, event: nil, percentage: nil, text: nil, confidence: nil, durationMs: nil, error: nil)
      case "transcribe":
        let directory = try requiredDirectory(from: request)
        guard let filePath = request.filePath, !filePath.isEmpty else {
          throw HostError.missingFilePath
        }
        let result = try await transcribe(filePath: filePath, modelDirectory: directory)
        return HostResponse(
          id: request.id,
          ok: true,
          event: nil,
          percentage: nil,
          text: result.text,
          confidence: result.confidence,
          durationMs: Int((result.duration * 1000).rounded()),
          error: nil
        )
      case "unload":
        await manager?.cleanup()
        manager = nil
        loadedModelDirectory = nil
        return HostResponse(id: request.id, ok: true, event: nil, percentage: nil, text: nil, confidence: nil, durationMs: nil, error: nil)
      default:
        throw HostError.unsupportedCommand(request.command)
      }
    } catch {
      return HostResponse(
        id: request.id,
        ok: false,
        event: nil,
        percentage: nil,
        text: nil,
        confidence: nil,
        durationMs: nil,
        error: error.localizedDescription
      )
    }
  }

  private func requiredDirectory(from request: HostRequest) throws -> URL {
    guard let modelDirectory = request.modelDirectory, !modelDirectory.isEmpty else {
      throw HostError.missingModelDirectory
    }
    return URL(fileURLWithPath: modelDirectory, isDirectory: true)
  }

  private func repositoryDirectory(in modelDirectory: URL) -> URL {
    modelDirectory.appendingPathComponent(modelRepositoryName, isDirectory: true)
  }

  private func install(
    into modelDirectory: URL,
    reportProgress: @escaping @Sendable (Double) -> Void
  ) async throws {
    try FileManager.default.createDirectory(at: modelDirectory, withIntermediateDirectories: true)
    let repositoryDirectory = repositoryDirectory(in: modelDirectory)
    _ = try await AsrModels.download(
      to: repositoryDirectory,
      version: .v3,
      progressHandler: { progress in reportProgress(progress.fractionCompleted) }
    )
  }

  private func warm(directory: URL) async throws {
    if directory == loadedModelDirectory, manager != nil {
      return
    }

    let models = try await AsrModels.load(from: repositoryDirectory(in: directory), version: .v3)
    manager = AsrManager(models: models)
    loadedModelDirectory = directory
  }

  private func transcribe(filePath: String, modelDirectory: URL) async throws -> ASRResult {
    try await warm(directory: modelDirectory)
    guard let manager else {
      throw HostError.notLoaded
    }

    var decoderState = try TdtDecoderState(decoderLayers: await manager.decoderLayerCount)
    return try await manager.transcribe(
      URL(fileURLWithPath: filePath),
      decoderState: &decoderState
    )
  }
}

private actor HostOutput {
  private let encoder = JSONEncoder()

  func send(_ response: HostResponse) {
    guard let data = try? encoder.encode(response) else {
      return
    }
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data("\n".utf8))
  }
}

private enum HostError: LocalizedError {
  case missingFilePath
  case missingModelDirectory
  case notLoaded
  case unsupportedCommand(String)

  var errorDescription: String? {
    switch self {
    case .missingFilePath:
      return "A file path is required for transcription."
    case .missingModelDirectory:
      return "A Parakeet model directory is required."
    case .notLoaded:
      return "The Parakeet model is not loaded."
    case .unsupportedCommand(let command):
      return "Unsupported ASR host command: \(command)."
    }
  }
}

@main
struct OpenVocalyAsrHost {
  static func main() async {
    let engine = ParakeetEngine()
    let decoder = JSONDecoder()
    let output = HostOutput()

    do {
      for try await line in FileHandle.standardInput.bytes.lines {
        guard let data = line.data(using: .utf8) else {
          continue
        }

        let response: HostResponse
        do {
          let request = try decoder.decode(HostRequest.self, from: data)
          response = await engine.handle(request, reportProgress: { fraction in
            Task {
              await output.send(
                HostResponse(
                  id: request.id,
                  ok: true,
                  event: "progress",
                  percentage: Int((min(max(fraction, 0), 1) * 100).rounded()),
                  text: nil,
                  confidence: nil,
                  durationMs: nil,
                  error: nil
                )
              )
            }
          })
        } catch {
          response = HostResponse(
            id: "unknown",
            ok: false,
            event: nil,
            percentage: nil,
            text: nil,
            confidence: nil,
            durationMs: nil,
            error: "Invalid ASR host request: \(error.localizedDescription)"
          )
        }

        await output.send(response)
      }
    } catch {
      FileHandle.standardError.write(
        Data("ASR host input failed: \(error.localizedDescription)\\n".utf8)
      )
    }
  }
}
