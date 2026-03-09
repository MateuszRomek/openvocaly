import { is } from '@electron-toolkit/utils'
import pino, { type LevelWithSilent, type LoggerOptions, type TransportSingleOptions } from 'pino'

const LOG_LEVELS: ReadonlySet<LevelWithSilent> = new Set([
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent'
])

const normalizeLogLevel = (value: string | undefined): LevelWithSilent => {
  const normalized = value?.trim().toLowerCase()
  if (normalized && LOG_LEVELS.has(normalized as LevelWithSilent)) {
    return normalized as LevelWithSilent
  }

  return 'info'
}

const resolveLogLevel = (): LevelWithSilent =>
  normalizeLogLevel(process.env['LOGLEVEL'] ?? process.env['LOG_LEVEL'])

const PRETTY_DISABLED_VALUES = new Set(['0', 'false', 'off', 'no'])
const REDACT_PATHS = [
  'apiKey',
  '*.apiKey',
  'encryptedApiKey',
  '*.encryptedApiKey',
  'authorization',
  '*.authorization',
  'headers.authorization',
  'artifact.filePath',
  '*.filePath',
  'transcriptionResult.transcript.text'
]

const resolvePrettyTransport = (): TransportSingleOptions | undefined => {
  if (!is.dev) {
    return undefined
  }

  const prettyFlag = (process.env['LOG_PRETTY'] ?? '1').trim().toLowerCase()
  if (PRETTY_DISABLED_VALUES.has(prettyFlag)) {
    return undefined
  }

  return {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
}

const loggerOptions: LoggerOptions = {
  level: resolveLogLevel(),
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]'
  }
}

const prettyTransport = resolvePrettyTransport()

export const mainLogger = prettyTransport
  ? pino(loggerOptions, pino.transport(prettyTransport))
  : pino(loggerOptions)

export const createLogger = (scope: string): pino.Logger => mainLogger.child({ scope })
