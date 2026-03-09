#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */
const fs = require('node:fs')
const { chmod, mkdir } = require('node:fs/promises')
const { join } = require('node:path')
const { spawn } = require('node:child_process')

const PROJECT_ROOT = join(__dirname, '..')
const SOURCE_PATH = join(PROJECT_ROOT, 'resources', 'macos-fast-paste.swift')
const OUTPUT_DIR = join(PROJECT_ROOT, 'resources', 'bin')
const OUTPUT_PATH = join(OUTPUT_DIR, 'macos-fast-paste')

const runCompile = (command, args) =>
  new Promise((resolve, reject) => {
    const processRef = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
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

      reject(
        new Error(
          stderr.trim().length > 0
            ? stderr.trim()
            : `${command} failed with exit code ${code ?? 'unknown'}`
        )
      )
    })
  })

const run = async () => {
  if (process.platform !== 'darwin') {
    console.log('[macos-fast-paste] Skipping compile on non-macOS platform.')
    return
  }

  if (!fs.existsSync(SOURCE_PATH)) {
    console.warn('[macos-fast-paste] Source file missing, skipping compile.')
    return
  }

  await mkdir(OUTPUT_DIR, { recursive: true })

  const compileArgs = ['swiftc', '-O', SOURCE_PATH, '-o', OUTPUT_PATH]

  try {
    await runCompile('xcrun', compileArgs)
  } catch (primaryError) {
    try {
      await runCompile('swiftc', ['-O', SOURCE_PATH, '-o', OUTPUT_PATH])
    } catch (fallbackError) {
      console.warn(
        '[macos-fast-paste] Failed to compile native paste binary. Using AppleScript fallback.'
      )
      console.warn(
        '[macos-fast-paste] Compile errors:',
        primaryError instanceof Error ? primaryError.message : String(primaryError),
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      )
      return
    }
  }

  await chmod(OUTPUT_PATH, 0o755)
  console.log('[macos-fast-paste] Built native paste binary at', OUTPUT_PATH)
}

run().catch((error) => {
  console.warn('[macos-fast-paste] Unexpected build error. Using AppleScript fallback.')
  console.warn('[macos-fast-paste] Error:', error instanceof Error ? error.message : String(error))
})
