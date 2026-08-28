#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */
const fs = require('node:fs')
const { chmod, cp, mkdir } = require('node:fs/promises')
const { spawn } = require('node:child_process')
const { join } = require('node:path')

const projectRoot = join(__dirname, '..')
const sourceDirectory = join(projectRoot, 'native', 'macos-asr-host')
const outputDirectory = join(projectRoot, 'resources', 'bin')
const outputPath = join(outputDirectory, 'macos-asr-host')
const builtBinaryPath = join(sourceDirectory, '.build', 'release', 'OpenVocalyAsrHost')
const builtResourceBundlePath = join(
  sourceDirectory,
  '.build',
  'release',
  'FluidAudio_FluidAudio.bundle'
)
const outputResourceBundlePath = join(outputDirectory, 'FluidAudio_FluidAudio.bundle')
const sourceInputs = [
  join(sourceDirectory, 'Package.swift'),
  join(sourceDirectory, 'Package.resolved'),
  join(sourceDirectory, 'Sources', 'OpenVocalyAsrHost', 'main.swift')
]

const run = (command, args, cwd) =>
  new Promise((resolve, reject) => {
    const processRef = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''

    processRef.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    processRef.on('error', reject)
    processRef.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(stderr.trim() || `${command} exited with code ${code ?? 'unknown'}.`))
    })
  })

const main = async () => {
  if (process.platform !== 'darwin') {
    console.log('[macos-asr-host] Skipping build on non-macOS platform.')
    return
  }

  if (!fs.existsSync(sourceDirectory)) {
    throw new Error('macOS ASR host source is missing.')
  }

  const outputIsCurrent =
    fs.existsSync(outputPath) &&
    fs.existsSync(outputResourceBundlePath) &&
    sourceInputs.every((input) => fs.statSync(input).mtimeMs <= fs.statSync(outputPath).mtimeMs)
  if (outputIsCurrent && !process.argv.includes('--force')) {
    console.log('[macos-asr-host] Native ASR host is already current (use --force to rebuild).')
    return
  }

  await run('swift', ['build', '--configuration', 'release', '--jobs', '2'], sourceDirectory)
  await mkdir(outputDirectory, { recursive: true })
  await cp(builtBinaryPath, outputPath, { force: true })
  if (fs.existsSync(builtResourceBundlePath)) {
    await cp(builtResourceBundlePath, outputResourceBundlePath, { force: true, recursive: true })
  }
  await chmod(outputPath, 0o755)
  console.log('[macos-asr-host] Built native ASR host at', outputPath)
}

main().catch((error) => {
  console.error('[macos-asr-host] Failed to build native ASR host:', error.message)
  process.exit(1)
})
