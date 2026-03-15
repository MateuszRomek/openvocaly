#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */
const fs = require('node:fs')
const { spawnSync } = require('node:child_process')
const { cp, mkdir, mkdtemp, rm } = require('node:fs/promises')
const { spawn } = require('node:child_process')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const WHISPER_CPP_TAG = process.env.WHISPER_CPP_TAG || 'v1.8.3'
const WHISPER_CPP_REPO_URL = 'https://github.com/ggml-org/whisper.cpp.git'
const BIN_DIR = join(__dirname, '..', 'resources', 'bin')
const UNIVERSAL_OUTPUTS = ['whisper-server-darwin-arm64', 'whisper-server-darwin-x64']
const HOMEBREW_BIN_CANDIDATES = ['/opt/homebrew/bin', '/usr/local/bin']

const runCommand = async (command, args, options = {}) => {
  await new Promise((resolve, reject) => {
    const stdio = options.inheritStdio ? 'inherit' : ['ignore', 'pipe', 'pipe']
    const processRef = spawn(command, args, {
      cwd: options.cwd,
      stdio,
      windowsHide: true,
      env: {
        ...process.env,
        ...(options.env || {})
      }
    })

    let stderr = ''
    let stdout = ''

    if (!options.inheritStdio) {
      processRef.stdout.on('data', (chunk) => {
        stdout += String(chunk)
      })

      processRef.stderr.on('data', (chunk) => {
        stderr += String(chunk)
      })
    }

    processRef.on('error', (error) => {
      reject(new Error(`Failed to start ${command}: ${error.message}`))
    })

    processRef.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          [
            `${command} ${args.join(' ')} exited with code ${code}.`,
            stdout.trim().slice(-800),
            stderr.trim().slice(-800)
          ]
            .filter(Boolean)
            .join('\n')
        )
      )
    })
  })
}

const setExecutable = (filePath) => {
  fs.chmodSync(filePath, 0o755)
}

const exists = (filePath) => fs.existsSync(filePath)
const getHostOutputName = () =>
  process.arch === 'arm64' ? 'whisper-server-darwin-arm64' : 'whisper-server-darwin-x64'

const canExecuteWhisperServer = (binaryPath) => {
  const probe = spawnSync(binaryPath, ['--help'], {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true
  })

  if (probe.error) {
    return false
  }

  return probe.status === 0
}

const isExistingRuntimeUsable = () => {
  const hostOutputPath = join(BIN_DIR, getHostOutputName())
  if (!exists(hostOutputPath)) {
    return false
  }

  return canExecuteWhisperServer(hostOutputPath)
}
const getBrewEnv = () => {
  const currentPath = process.env.PATH || ''
  const pathEntries = currentPath.split(':').filter(Boolean)
  const merged = [...new Set([...HOMEBREW_BIN_CANDIDATES, ...pathEntries])]
  return { PATH: merged.join(':') }
}

const isCommandAvailable = (command, env = {}) => {
  const probe = spawnSync(command, ['--version'], {
    stdio: 'ignore',
    windowsHide: true,
    env: {
      ...process.env,
      ...env
    }
  })
  return probe.error === undefined && probe.status === 0
}

const isXcodeCommandLineToolsInstalled = () => {
  const probe = spawnSync('xcode-select', ['-p'], {
    stdio: 'ignore',
    windowsHide: true
  })
  return probe.status === 0
}

const allOutputsExist = () =>
  UNIVERSAL_OUTPUTS.every((outputName) => exists(join(BIN_DIR, outputName)))

const findBuiltBinary = (buildDir) => {
  const candidates = [
    join(buildDir, 'bin', 'whisper-server'),
    join(buildDir, 'bin', 'Release', 'whisper-server'),
    join(buildDir, 'Release', 'whisper-server')
  ]

  for (const candidate of candidates) {
    if (exists(candidate)) {
      return candidate
    }
  }

  return null
}

const copyUniversalBinary = async (binaryPath) => {
  for (const outputName of UNIVERSAL_OUTPUTS) {
    const outputPath = join(BIN_DIR, outputName)
    await cp(binaryPath, outputPath, { force: true })
    setExecutable(outputPath)
  }
}

const ensureHomebrew = async () => {
  if (isCommandAvailable('brew', getBrewEnv())) {
    return
  }

  console.log('Homebrew not found. Installing Homebrew...')
  await runCommand(
    '/bin/bash',
    [
      '-c',
      'curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh | NONINTERACTIVE=1 /bin/bash'
    ],
    { inheritStdio: true }
  )

  if (!isCommandAvailable('brew', getBrewEnv())) {
    throw new Error('Homebrew installation completed but brew was not found in PATH.')
  }
}

const installToolViaHomebrew = async (toolName) => {
  const formula = toolName === 'cmake' ? 'cmake' : toolName
  console.log(`Installing missing dependency: ${toolName} (brew install ${formula})`)
  await runCommand('brew', ['install', formula], {
    env: getBrewEnv(),
    inheritStdio: true
  })
}

const ensureRequiredBuildTools = async () => {
  if (process.platform === 'darwin' && !isXcodeCommandLineToolsInstalled()) {
    console.log('Xcode Command Line Tools not found. Starting installation...')
    try {
      await runCommand('xcode-select', ['--install'], { inheritStdio: true })
    } catch {
      // xcode-select may return non-zero if install dialog was already opened.
    }

    throw new Error(
      'Xcode Command Line Tools are required to build whisper.cpp. Complete the installation, then rerun.'
    )
  }

  const requiredTools = ['git', 'cmake']
  let missingTools = requiredTools.filter((tool) => !isCommandAvailable(tool, getBrewEnv()))
  if (missingTools.length === 0) {
    return
  }

  if (process.platform !== 'darwin') {
    throw new Error(`Missing required tools: ${missingTools.join(', ')}`)
  }

  await ensureHomebrew()
  for (const tool of missingTools) {
    if (isCommandAvailable(tool, getBrewEnv())) {
      continue
    }
    await installToolViaHomebrew(tool)
  }

  missingTools = requiredTools.filter((tool) => !isCommandAvailable(tool, getBrewEnv()))
  if (missingTools.length > 0) {
    throw new Error(`Unable to install required tools automatically: ${missingTools.join(', ')}`)
  }
}

const buildWhisperServer = async ({ sourceDir, buildDir, cmakeArchValue }) => {
  await runCommand(
    'cmake',
    [
      '-S',
      sourceDir,
      '-B',
      buildDir,
      '-DCMAKE_BUILD_TYPE=Release',
      '-DBUILD_SHARED_LIBS=OFF',
      '-DWHISPER_BUILD_SERVER=ON',
      '-DWHISPER_BUILD_EXAMPLES=ON',
      '-DWHISPER_BUILD_TESTS=OFF',
      `-DCMAKE_OSX_ARCHITECTURES=${cmakeArchValue}`
    ],
    {
      env: getBrewEnv()
    }
  )

  await runCommand(
    'cmake',
    ['--build', buildDir, '--config', 'Release', '--target', 'whisper-server'],
    {
      env: getBrewEnv()
    }
  )

  const binaryPath = findBuiltBinary(buildDir)
  if (!binaryPath) {
    throw new Error('Unable to find whisper-server binary after build.')
  }

  return binaryPath
}

const run = async () => {
  if (process.platform !== 'darwin') {
    console.log(`No whisper.cpp runtime build configured for ${process.platform}.`)
    process.exit(0)
  }

  await mkdir(BIN_DIR, { recursive: true })

  if (allOutputsExist() && !process.argv.includes('--force')) {
    if (isExistingRuntimeUsable()) {
      console.log('Whisper runtime already exists (use --force to rebuild).')
      process.exit(0)
    }

    console.warn('Existing whisper runtime binaries are not usable. Rebuilding...')
  }

  await ensureRequiredBuildTools()

  const tmpRoot = await mkdtemp(join(tmpdir(), 'openvocaly-whisper-cpp-'))
  const sourceDir = join(tmpRoot, `whisper.cpp-${WHISPER_CPP_TAG}`)

  try {
    console.log(`Cloning whisper.cpp (${WHISPER_CPP_TAG}) from ${WHISPER_CPP_REPO_URL}`)
    await runCommand(
      'git',
      ['clone', '--depth', '1', '--branch', WHISPER_CPP_TAG, WHISPER_CPP_REPO_URL, sourceDir],
      {
        env: getBrewEnv()
      }
    )

    let binaryPath
    try {
      console.log('Building universal whisper-server binary (arm64 + x64)...')
      const universalBuildDir = join(tmpRoot, 'build-universal')
      binaryPath = await buildWhisperServer({
        sourceDir,
        buildDir: universalBuildDir,
        cmakeArchValue: 'arm64;x86_64'
      })
      await copyUniversalBinary(binaryPath)
    } catch (error) {
      console.warn(
        'Universal build failed, retrying host-arch whisper-server build:',
        error instanceof Error ? error.message : error
      )

      const hostBuildDir = join(tmpRoot, 'build-host')
      binaryPath = await buildWhisperServer({
        sourceDir,
        buildDir: hostBuildDir,
        cmakeArchValue: process.arch === 'arm64' ? 'arm64' : 'x86_64'
      })

      const outputName =
        process.arch === 'arm64' ? 'whisper-server-darwin-arm64' : 'whisper-server-darwin-x64'
      const outputPath = join(BIN_DIR, outputName)
      await cp(binaryPath, outputPath, { force: true })
      setExecutable(outputPath)

      // Keep both aliases available for runtime discovery.
      const aliasName =
        process.arch === 'arm64' ? 'whisper-server-darwin-x64' : 'whisper-server-darwin-arm64'
      const aliasPath = join(BIN_DIR, aliasName)
      await cp(outputPath, aliasPath, { force: true })
      setExecutable(aliasPath)
    }

    console.log(`Saved whisper-server binaries in ${BIN_DIR}`)
    const saved = fs
      .readdirSync(BIN_DIR)
      .filter((name) => name.startsWith('whisper-server-darwin-'))
      .map(
        (name) => `${name} (${Math.round(fs.statSync(join(BIN_DIR, name)).size / 1024 / 1024)}MB)`
      )
    for (const line of saved) {
      console.log(`- ${line}`)
    }
  } finally {
    await rm(tmpRoot, { recursive: true, force: true })
  }
}

run().catch((error) => {
  console.error(`Failed to build whisper.cpp runtime: ${error.message}`)
  process.exit(1)
})
