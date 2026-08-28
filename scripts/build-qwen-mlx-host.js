#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const { cp, mkdir, mkdtemp, rm } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const projectRoot = join(__dirname, '..')
const sourceDirectory = join(projectRoot, 'native', 'qwen-mlx-host')
const hostSourcePath = join(sourceDirectory, 'openvocaly_qwen_mlx_host.py')
const requirementsPath = join(sourceDirectory, 'requirements.txt')
const outputDirectory = join(projectRoot, 'resources', 'qwen-mlx-host')
const outputPath = join(outputDirectory, 'qwen-mlx-host')
const pythonCommand = process.env.QWEN_MLX_PYTHON || 'python3'

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const processRef = spawn(command, args, {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...(options.env || {}) }
    })
    let stdout = ''
    let stderr = ''
    processRef.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    processRef.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    processRef.once('error', (error) =>
      reject(new Error(`Failed to start ${command}: ${error.message}`))
    )
    processRef.once('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(
        new Error(
          [`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}.`, stdout, stderr]
            .filter(Boolean)
            .join('\n')
            .slice(-4000)
        )
      )
    })
  })

/**
 * Builds a self-contained macOS executable rather than depending on a user's
 * Python installation. PyInstaller bundles the pinned Qwen MLX implementation
 * and MLX's native libraries; models remain separately user-downloadable.
 */
const main = async () => {
  if (process.platform !== 'darwin') {
    console.log('[qwen-mlx-host] Skipping build on non-macOS platform.')
    return
  }
  if (process.arch !== 'arm64') {
    console.log('[qwen-mlx-host] Skipping build on non-Apple-Silicon architecture.')
    return
  }
  if (!fs.existsSync(hostSourcePath) || !fs.existsSync(requirementsPath)) {
    throw new Error('Qwen MLX host source is missing.')
  }

  const outputIsCurrent =
    fs.existsSync(outputPath) &&
    [hostSourcePath, requirementsPath].every(
      (input) => fs.statSync(input).mtimeMs <= fs.statSync(outputPath).mtimeMs
    )
  if (outputIsCurrent && !process.argv.includes('--force')) {
    console.log('[qwen-mlx-host] Bundled MLX host is already current (use --force to rebuild).')
    return
  }

  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'openvocaly-qwen-mlx-build-'))
  const virtualEnvironmentDirectory = join(temporaryDirectory, 'venv')
  const pythonPath = join(virtualEnvironmentDirectory, 'bin', 'python')
  const distributionDirectory = join(temporaryDirectory, 'dist')

  try {
    await run(pythonCommand, ['-m', 'venv', virtualEnvironmentDirectory])
    await run(pythonPath, ['-m', 'pip', 'install', '--upgrade', 'pip'])
    await run(pythonPath, ['-m', 'pip', 'install', '--requirement', requirementsPath])
    await run(pythonPath, [
      '-m',
      'PyInstaller',
      '--noconfirm',
      '--clean',
      '--onedir',
      '--name',
      'qwen-mlx-host',
      // MLX loads Python helpers and Metal/JACC libraries dynamically, outside
      // PyInstaller's normal import graph. Bundle its full runtime explicitly.
      '--collect-all',
      'mlx',
      '--distpath',
      distributionDirectory,
      '--workpath',
      join(temporaryDirectory, 'work'),
      '--specpath',
      temporaryDirectory,
      hostSourcePath
    ])

    await mkdir(join(projectRoot, 'resources'), { recursive: true })
    await rm(outputDirectory, { recursive: true, force: true })
    await cp(join(distributionDirectory, 'qwen-mlx-host'), outputDirectory, {
      recursive: true,
      force: true,
      // PyInstaller uses absolute symlinks inside a temporary dist directory.
      // Dereference them before removing that directory so the shipped host is
      // self-contained instead of pointing at a vanished build path.
      dereference: true
    })
    // MLX resolves its default Metal library relative to libmlx.dylib rather
    // than its Python package path. Keep the version-matched shader next to
    // that library; copying it beside the executable is unnecessary.
    const metallibSourcePath = join(outputDirectory, '_internal', 'mlx', 'lib', 'mlx.metallib')
    if (!fs.existsSync(metallibSourcePath)) {
      throw new Error('The bundled MLX runtime is missing mlx.metallib.')
    }
    await cp(metallibSourcePath, join(outputDirectory, '_internal', 'mlx.metallib'), {
      force: true
    })
    await rm(metallibSourcePath)
    console.log('[qwen-mlx-host] Bundled MLX host at', outputPath)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined)
  }
}

main().catch((error) => {
  console.error('[qwen-mlx-host] Failed to build bundled MLX host:', error.message)
  process.exit(1)
})
