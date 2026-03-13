#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */
const fs = require('node:fs')
const { cp, mkdir, mkdtemp, rm, rename } = require('node:fs/promises')
const { request: httpsRequest } = require('node:https')
const { tmpdir } = require('node:os')
const { join, basename, dirname } = require('node:path')
const { spawn } = require('node:child_process')

// Version can be pinned via environment variable for reproducible builds.
const SHERPA_VERSION = process.env.SHERPA_ONNX_VERSION || '1.12.23'
const BIN_DIR = join(__dirname, '..', 'resources', 'bin')

const BINARIES = {
  'darwin-arm64': {
    archiveName: `sherpa-onnx-v${SHERPA_VERSION}-osx-universal2-shared.tar.bz2`,
    binaryName: 'sherpa-onnx-offline-websocket-server',
    outputName: 'sherpa-onnx-ws-darwin-arm64'
  },
  'darwin-x64': {
    archiveName: `sherpa-onnx-v${SHERPA_VERSION}-osx-universal2-shared.tar.bz2`,
    binaryName: 'sherpa-onnx-offline-websocket-server',
    outputName: 'sherpa-onnx-ws-darwin-x64'
  },
  'win32-x64': {
    archiveName: `sherpa-onnx-v${SHERPA_VERSION}-win-x64-shared.tar.bz2`,
    binaryName: 'sherpa-onnx-offline-websocket-server.exe',
    outputName: 'sherpa-onnx-ws-win32-x64.exe'
  },
  'linux-x64': {
    archiveName: `sherpa-onnx-v${SHERPA_VERSION}-linux-x64-shared.tar.bz2`,
    binaryName: 'sherpa-onnx-offline-websocket-server',
    outputName: 'sherpa-onnx-ws-linux-x64'
  }
}

const getPlatformArch = () => `${process.platform}-${process.arch}`

const downloadFile = async (url, destinationPath) => {
  await new Promise((resolve, reject) => {
    const requestRef = httpsRequest(url, (response) => {
      const statusCode = response.statusCode ?? 0
      if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, destinationPath).then(resolve).catch(reject)
        return
      }

      if (statusCode < 200 || statusCode >= 300) {
        reject(new Error(`Download failed with status ${statusCode}`))
        return
      }

      const output = fs.createWriteStream(destinationPath)
      response.pipe(output)
      output.on('finish', () => {
        output.close(resolve)
      })
      output.on('error', reject)
    })

    requestRef.on('error', reject)
    requestRef.end()
  })
}

const extractArchive = async (archivePath, outputDir) => {
  await new Promise((resolve, reject) => {
    const processRef = spawn('tar', ['-xjf', archivePath, '-C', outputDir], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stderr = ''

    processRef.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    processRef.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`tar extract failed (${code}): ${stderr.slice(-300)}`))
    })

    processRef.on('error', reject)
  })
}

const findBinaryInDir = (rootDir, binaryName) => {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(rootDir, entry.name)
    if (entry.isFile() && entry.name === binaryName) {
      return fullPath
    }
    if (entry.isDirectory()) {
      const nested = findBinaryInDir(fullPath, binaryName)
      if (nested) {
        return nested
      }
    }
  }
  return null
}

const setExecutable = (filePath) => {
  if (process.platform !== 'win32') {
    fs.chmodSync(filePath, 0o755)
  }
}

const isDynamicLibraryFile = (fileName) =>
  fileName.endsWith('.dylib') || fileName.includes('.so') || fileName.toLowerCase().endsWith('.dll')

const listFilesRecursive = (rootDir) => {
  if (!fs.existsSync(rootDir)) {
    return []
  }

  const files = []
  const entries = fs.readdirSync(rootDir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath))
      continue
    }
    if (entry.isFile()) {
      files.push(fullPath)
    }
  }

  return files
}

const findPackageRootFromBinary = (binaryPath) => {
  let current = dirname(binaryPath)
  for (let index = 0; index < 6; index += 1) {
    const hasLibDir = fs.existsSync(join(current, 'lib'))
    const hasBinDir = fs.existsSync(join(current, 'bin'))
    if (hasLibDir && hasBinDir) {
      return current
    }
    const parent = dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }

  return null
}

const copyRuntimeLibraries = async (binaryPath) => {
  const packageRoot = findPackageRootFromBinary(binaryPath)
  if (!packageRoot) {
    return []
  }

  const libraryFiles = [
    ...listFilesRecursive(join(packageRoot, 'lib')),
    ...listFilesRecursive(join(packageRoot, 'bin'))
  ].filter((filePath) => {
    const fileName = basename(filePath)
    return isDynamicLibraryFile(fileName)
  })

  const copied = []
  for (const filePath of libraryFiles) {
    const destinationPath = join(BIN_DIR, basename(filePath))
    await cp(filePath, destinationPath, { force: true, dereference: true })
    copied.push(destinationPath)
  }

  return copied
}

const hasPlatformDependencies = () => {
  if (process.platform === 'darwin') {
    return (
      fs.existsSync(join(BIN_DIR, 'libonnxruntime.1.23.2.dylib')) ||
      fs.existsSync(join(BIN_DIR, 'libonnxruntime.dylib'))
    )
  }

  if (process.platform === 'win32') {
    return listFilesRecursive(BIN_DIR).some((filePath) =>
      basename(filePath).toLowerCase().includes('onnxruntime')
    )
  }

  if (process.platform === 'linux') {
    return listFilesRecursive(BIN_DIR).some((filePath) => basename(filePath).includes('.so'))
  }

  return true
}

const ensureDarwinBinaryAliases = async () => {
  if (process.platform !== 'darwin') {
    return
  }

  const armPath = join(BIN_DIR, 'sherpa-onnx-ws-darwin-arm64')
  const x64Path = join(BIN_DIR, 'sherpa-onnx-ws-darwin-x64')

  if (fs.existsSync(armPath) && !fs.existsSync(x64Path)) {
    await cp(armPath, x64Path)
    setExecutable(x64Path)
  }

  if (fs.existsSync(x64Path) && !fs.existsSync(armPath)) {
    await cp(x64Path, armPath)
    setExecutable(armPath)
  }
}

const run = async () => {
  const platformArch = getPlatformArch()
  const config = BINARIES[platformArch]
  if (!config) {
    console.log(`No sherpa-onnx runtime configured for ${platformArch}.`)
    process.exit(0)
  }

  await mkdir(BIN_DIR, { recursive: true })

  const outputPath = join(BIN_DIR, config.outputName)
  if (fs.existsSync(outputPath) && hasPlatformDependencies() && !process.argv.includes('--force')) {
    await ensureDarwinBinaryAliases()
    console.log(`Local runtime already exists at ${outputPath} (use --force to re-download).`)
    process.exit(0)
  }

  const baseUrl = `https://github.com/k2-fsa/sherpa-onnx/releases/download/v${SHERPA_VERSION}`
  const archiveUrl = `${baseUrl}/${config.archiveName}`

  const tempRoot = await mkdtemp(join(tmpdir(), 'openvocaly-sherpa-'))
  const archivePath = join(tempRoot, basename(config.archiveName))
  const extractDir = join(tempRoot, 'extract')
  await mkdir(extractDir, { recursive: true })

  try {
    console.log(`Downloading sherpa-onnx runtime from ${archiveUrl}`)
    await downloadFile(archiveUrl, archivePath)
    await extractArchive(archivePath, extractDir)

    const binaryPath = findBinaryInDir(extractDir, config.binaryName)
    if (!binaryPath) {
      throw new Error(`Unable to find ${config.binaryName} in extracted archive.`)
    }

    if (fs.existsSync(outputPath)) {
      await rm(outputPath, { force: true })
    }

    const copiedLibraries = await copyRuntimeLibraries(binaryPath)
    await rename(binaryPath, outputPath)
    setExecutable(outputPath)
    await ensureDarwinBinaryAliases()

    if (copiedLibraries.length > 0) {
      console.log(`Copied ${copiedLibraries.length} runtime dependency files.`)
    }
    console.log(`Saved runtime binary: ${outputPath}`)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

run().catch((error) => {
  console.error(`Failed to download sherpa-onnx runtime: ${error.message}`)
  process.exit(1)
})
