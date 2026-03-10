import { execFile } from 'node:child_process'
import { accessSync, chmodSync, constants as fsConstants, existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { SELF_PROCESS_NAME_ALIASES } from './constants'

const execFileAsync = promisify(execFile)

type FrontProcessInput = {
  frontProcessName?: string
  frontProcessPid?: number
}

type NativeBinaryCandidatesInput = {
  resourcesPath?: string
  appPath: string
  cwd: string
  binaryName: string
}

export type ParsedEditableProbeOutput = {
  isEditable: boolean
  frontProcessName?: string
  frontProcessIdentifier?: string
  frontProcessPath?: string
  frontProcessPid?: number
  focusedRole?: string
  focusedSubrole?: string
}

export type ParsedNativeProbeOutput = ParsedEditableProbeOutput & {
  ok: boolean
  message?: string
}

export const runAppleScript = async (lines: readonly string[]): Promise<string> => {
  const args = lines.flatMap((line) => ['-e', line])
  const { stdout } = await execFileAsync('osascript', args)
  return stdout.trim()
}

export const normalizeAppleScriptText = (value: string): string | undefined => {
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === 'missing value') {
    return undefined
  }

  return trimmed
}

export const resolveSelfProcessNames = (appName: string): Set<string> => {
  const names = new Set<string>(SELF_PROCESS_NAME_ALIASES.map((name) => name.toLowerCase()))
  const normalizedAppName = appName.trim().toLowerCase()
  if (normalizedAppName) {
    names.add(normalizedAppName)
  }

  return names
}

// Matches a probe result against the current process identity by pid first, then app-name aliases.
export const isSelfFrontProcess = (
  params: FrontProcessInput,
  selfProcessNames: ReadonlySet<string>
): boolean => {
  if (typeof params.frontProcessPid === 'number' && params.frontProcessPid === process.pid) {
    return true
  }

  if (!params.frontProcessName) {
    return false
  }

  return selfProcessNames.has(params.frontProcessName.toLowerCase())
}

export const parseEditableProbeOutput = (output: string): ParsedEditableProbeOutput => {
  const [
    editableRaw,
    processName = '',
    processPidRaw = '',
    role = '',
    subrole = '',
    processIdentifier = '',
    processPath = ''
  ] = output.split('\t', 7)
  const parsedProcessPid = Number.parseInt(processPidRaw, 10)

  return {
    isEditable: editableRaw === '1',
    frontProcessName: normalizeAppleScriptText(processName),
    frontProcessIdentifier: normalizeAppleScriptText(processIdentifier),
    frontProcessPath: normalizeAppleScriptText(processPath),
    frontProcessPid: Number.isFinite(parsedProcessPid) ? parsedProcessPid : undefined,
    focusedRole: normalizeAppleScriptText(role),
    focusedSubrole: normalizeAppleScriptText(subrole)
  }
}

const parseOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }

  return normalizeAppleScriptText(value)
}

const parseOptionalPid = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

export const parseNativeProbeOutput = (output: string): ParsedNativeProbeOutput => {
  const parsed = JSON.parse(output) as Record<string, unknown>

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Native probe returned invalid JSON payload.')
  }

  const isEditable = parsed['isEditable']
  if (typeof isEditable !== 'boolean') {
    throw new Error('Native probe payload missing boolean isEditable field.')
  }

  const ok = parsed['ok']
  if (typeof ok !== 'boolean') {
    throw new Error('Native probe payload missing boolean ok field.')
  }

  return {
    ok,
    isEditable,
    frontProcessName: parseOptionalString(parsed['frontProcessName']),
    frontProcessIdentifier: parseOptionalString(parsed['frontProcessIdentifier']),
    frontProcessPath: parseOptionalString(parsed['frontProcessPath']),
    frontProcessPid: parseOptionalPid(parsed['frontProcessPid']),
    focusedRole: parseOptionalString(parsed['focusedRole']),
    focusedSubrole: parseOptionalString(parsed['focusedSubrole']),
    message: parseOptionalString(parsed['message'])
  }
}

// Candidate order is intentional: packaged app paths first, then dev/workspace fallback.
export const buildNativePasteBinaryCandidates = (params: NativeBinaryCandidatesInput): string[] => {
  const { resourcesPath, appPath, cwd, binaryName } = params
  const candidates = [
    resourcesPath ? join(resourcesPath, 'bin', binaryName) : null,
    resourcesPath ? join(resourcesPath, 'resources', 'bin', binaryName) : null,
    resourcesPath ? join(resourcesPath, 'app.asar.unpacked', 'resources', 'bin', binaryName) : null,
    join(appPath, 'resources', 'bin', binaryName),
    join(cwd, 'resources', 'bin', binaryName)
  ]

  const unique = new Set<string>()
  for (const candidate of candidates) {
    if (candidate) {
      unique.add(candidate)
    }
  }

  return Array.from(unique)
}

const hasExecutePermission = (path: string): boolean => {
  try {
    accessSync(path, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

const ensureExecutable = (path: string): boolean => {
  if (hasExecutePermission(path)) {
    return true
  }

  try {
    chmodSync(path, 0o755)
  } catch {
    return false
  }

  return hasExecutePermission(path)
}

// Returns the first existing candidate that is executable (or can be chmod'ed executable).
export const resolveFirstExecutableCandidate = (candidates: readonly string[]): string | null => {
  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue
    }

    if (ensureExecutable(candidate)) {
      return candidate
    }
  }

  return null
}

// Builds a concise error payload from native helper exit code + stderr output.
export const toNativePasteExitMessage = (code: number | null, stderrOutput: string): string => {
  const details = stderrOutput.trim()
  if (details.length > 0) {
    return `Native macOS paste binary exited with code ${code ?? 'unknown'}: ${details}`
  }

  return `Native macOS paste binary exited with code ${code ?? 'unknown'}.`
}

export const toNativeProbeExitMessage = (code: number | null, stderrOutput: string): string => {
  const details = stderrOutput.trim()
  if (details.length > 0) {
    return `Native macOS probe command exited with code ${code ?? 'unknown'}: ${details}`
  }

  return `Native macOS probe command exited with code ${code ?? 'unknown'}.`
}
