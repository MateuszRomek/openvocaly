#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */
/**
 * Measures the local whisper.cpp server with the same transport configuration
 * used by the Electron runtime. It intentionally reports only timing and
 * resource metadata, never the transcription text from the supplied audio.
 */
const { spawn, execFile } = require('node:child_process')
const { existsSync } = require('node:fs')
const { readFile, mkdtemp, rm } = require('node:fs/promises')
const { createServer } = require('node:net')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { performance } = require('node:perf_hooks')
const { promisify } = require('node:util')

const ffmpegPath = require('ffmpeg-static')

const execFileAsync = promisify(execFile)
const projectRoot = join(__dirname, '..')
const STARTUP_TIMEOUT_MS = 30_000
const REQUEST_TIMEOUT_MS = 5 * 60_000
const SAMPLE_INTERVAL_MS = 100

const usage = () => {
  console.error(`Usage:
  npm run benchmark:whisper -- --audio /absolute/path/to/input.webm --model /absolute/path/to/ggml-model.bin [--threads 4] [--runs 3] [--no-gpu]

The command emits JSON timing and memory measurements only; it never prints the transcript.`)
}

const parsePositiveInteger = (value, flag, maximum) => {
  const number = Number.parseInt(value, 10)
  if (!Number.isInteger(number) || number < 1 || number > maximum) {
    throw new Error(`${flag} must be an integer between 1 and ${maximum}.`)
  }
  return number
}

const parseArguments = (argv) => {
  const options = { audio: null, model: null, threads: 4, runs: 3, noGpu: false }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const value = argv[index + 1]

    switch (argument) {
      case '--audio':
        options.audio = value ?? null
        index += 1
        break
      case '--model':
        options.model = value ?? null
        index += 1
        break
      case '--threads':
        options.threads = parsePositiveInteger(value, '--threads', 16)
        index += 1
        break
      case '--runs':
        options.runs = parsePositiveInteger(value, '--runs', 20)
        index += 1
        break
      case '--no-gpu':
        options.noGpu = true
        break
      default:
        throw new Error(`Unknown argument: ${argument}`)
    }
  }

  if (!options.audio || !options.model) {
    throw new Error('Both --audio and --model are required.')
  }

  return { ...options, audio: resolve(options.audio), model: resolve(options.model) }
}

const resolveWhisperServerPath = () => {
  if (process.platform !== 'darwin') {
    throw new Error('The benchmark currently supports macOS only.')
  }

  const binaryName =
    process.arch === 'arm64' ? 'whisper-server-darwin-arm64' : 'whisper-server-darwin-x64'
  const binaryPath = join(projectRoot, 'resources', 'bin', binaryName)

  if (!existsSync(binaryPath)) {
    throw new Error(
      `Whisper server is missing at ${binaryPath}. Run npm run build:whisper-cpp-runtime.`
    )
  }

  return binaryPath
}

const reserveLocalPort = async () =>
  await new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not reserve a local port for whisper-server.'))
        return
      }

      server.close((error) => (error ? reject(error) : resolvePort(address.port)))
    })
  })

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds))

const waitForServer = async (port, getStderr) => {
  const startedAt = performance.now()

  while (performance.now() - startedAt < STARTUP_TIMEOUT_MS) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`)
      if (response.ok) {
        return performance.now() - startedAt
      }
    } catch {
      // The server is still starting.
    }

    await wait(100)
  }

  throw new Error(`Whisper server startup timed out. ${getStderr().trim().slice(-1000)}`)
}

const readProcessRssKb = async (pid) => {
  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'rss=', '-p', String(pid)])
    const rssKb = Number.parseInt(stdout.trim(), 10)
    return Number.isFinite(rssKb) ? rssKb : null
  } catch {
    return null
  }
}

const getPcm16WavDurationMs = (wavBuffer) => {
  const isPcmWave =
    wavBuffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    wavBuffer.subarray(8, 12).toString('ascii') === 'WAVE'
  if (!isPcmWave) {
    throw new Error('FFmpeg did not produce a standard PCM WAV file.')
  }

  const byteRate = wavBuffer.readUInt32LE(28)
  if (byteRate === 0) {
    throw new Error('Generated WAV has an invalid byte rate.')
  }

  let offset = 12
  while (offset + 8 <= wavBuffer.length) {
    const chunkName = wavBuffer.subarray(offset, offset + 4).toString('ascii')
    const chunkSize = wavBuffer.readUInt32LE(offset + 4)
    if (chunkName === 'data') {
      return Math.round((chunkSize / byteRate) * 1_000)
    }

    offset += 8 + chunkSize + (chunkSize % 2)
  }

  throw new Error('Generated WAV has no data chunk.')
}

const postInference = async (port, audioWav) => {
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS)
  const formData = new FormData()
  formData.append('file', new Blob([audioWav], { type: 'audio/wav' }), 'audio.wav')
  formData.append('response_format', 'json')
  formData.append('language', 'auto')

  try {
    const response = await fetch(`http://127.0.0.1:${port}/inference`, {
      method: 'POST',
      body: formData,
      signal: abortController.signal
    })
    if (!response.ok) {
      throw new Error(`Whisper inference returned HTTP ${response.status}.`)
    }

    await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

const stopProcess = async (processRef) => {
  if (processRef.exitCode !== null || processRef.killed) {
    return
  }

  await new Promise((resolveStop) => {
    const timeout = setTimeout(() => {
      processRef.kill('SIGKILL')
      resolveStop()
    }, 5_000)
    processRef.once('close', () => {
      clearTimeout(timeout)
      resolveStop()
    })
    processRef.kill('SIGTERM')
  })
}

const measureInference = async (port, audioWav, audioDurationMs, pid) => {
  let peakRssKb = await readProcessRssKb(pid)
  const sampler = setInterval(() => {
    void readProcessRssKb(pid).then((rssKb) => {
      if (rssKb !== null) {
        peakRssKb = Math.max(peakRssKb ?? 0, rssKb)
      }
    })
  }, SAMPLE_INTERVAL_MS)
  sampler.unref()

  const startedAt = performance.now()
  try {
    await postInference(port, audioWav)
  } finally {
    clearInterval(sampler)
  }

  const elapsedMs = Math.round(performance.now() - startedAt)
  return {
    elapsedMs,
    realTimeFactor: Math.round((elapsedMs / audioDurationMs) * 1_000) / 1_000,
    peakRssMb: peakRssKb === null ? null : Math.round((peakRssKb / 1024) * 10) / 10
  }
}

const main = async () => {
  const options = parseArguments(process.argv.slice(2))
  const binaryPath = resolveWhisperServerPath()

  for (const filePath of [options.audio, options.model, ffmpegPath]) {
    if (!filePath || !existsSync(filePath)) {
      throw new Error(`Required file is unavailable: ${filePath ?? 'unknown'}`)
    }
  }

  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'openvocaly-whisper-benchmark-'))
  const wavPath = join(temporaryDirectory, 'audio.wav')
  let processRef = null

  try {
    await new Promise((resolveFfmpeg, reject) => {
      const ffmpeg = spawn(ffmpegPath, [
        '-y',
        '-i',
        options.audio,
        '-ar',
        '16000',
        '-ac',
        '1',
        wavPath
      ])
      let stderr = ''
      ffmpeg.stderr.on('data', (chunk) => {
        stderr = `${stderr}${String(chunk)}`
      })
      ffmpeg.once('error', reject)
      ffmpeg.once('close', (code) => {
        code === 0
          ? resolveFfmpeg()
          : reject(new Error(`FFmpeg conversion failed. ${stderr.trim().slice(-1000)}`))
      })
    })

    const port = await reserveLocalPort()
    let stderr = ''
    const args = [
      '--model',
      options.model,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--language',
      'auto',
      '--threads',
      String(options.threads)
    ]
    if (options.noGpu) {
      args.push('--no-gpu')
    }

    const startedAt = performance.now()
    processRef = spawn(binaryPath, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    processRef.stderr.on('data', (chunk) => {
      stderr = `${stderr}${String(chunk)}`.slice(-4_000)
    })
    const readyAfterMs = await waitForServer(port, () => stderr)
    const audioWav = await readFile(wavPath)
    const audioDurationMs = getPcm16WavDurationMs(audioWav)
    const runs = []

    for (let index = 0; index < options.runs; index += 1) {
      runs.push(await measureInference(port, audioWav, audioDurationMs, processRef.pid))
    }

    console.log(
      JSON.stringify(
        {
          configuration: {
            binary: binaryPath,
            model: options.model,
            threads: options.threads,
            gpuEnabled: !options.noGpu,
            runs: options.runs,
            audioDurationMs
          },
          timings: {
            serverReadyMs: Math.round(readyAfterMs),
            coldStartAndFirstInferenceMs: Math.round(
              performance.now() -
                startedAt -
                runs.slice(1).reduce((sum, run) => sum + run.elapsedMs, 0)
            ),
            inferenceRuns: runs
          }
        },
        null,
        2
      )
    )
  } finally {
    if (processRef) {
      await stopProcess(processRef)
    }
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(`[whisper-benchmark] ${error instanceof Error ? error.message : error}`)
  usage()
  process.exit(1)
})
