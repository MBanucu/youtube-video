// src/logging.ts - Pino logging configuration with child loggers

import pino from 'pino'

// Map LOG_LEVEL environment variable to Pino levels (supports both strings and legacy numbers)
const getLogLevel = () => {
  const level = process.env['LOG_LEVEL']?.toLowerCase()

  // Support Pino's standard string levels
  switch (level) {
    case 'fatal':
    case 'error':
    case 'warn':
    case 'info':
    case 'debug':
    case 'trace':
      return level
  }

  // Support legacy numeric format for backwards compatibility
  switch (level) {
    case '0':
      return 'error'
    case '1':
      return 'warn'
    case '2':
      return 'info'
    case '3':
      return 'debug'
    case '4':
      return 'trace'
    case '5':
      return 'fatal'
    default:
      return 'info'
  }
}

// Create Pino root logger with pretty printing for development
const rootLogger = pino({
  level: getLogLevel(),
  transport:
    process.env['NODE_ENV'] !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
          },
        }
      : undefined,
})

// Export root logger for backward compatibility
export const logger = rootLogger

// Export function to create child loggers with context
export function getLogger(context: Record<string, unknown> = {}) {
  return rootLogger.child(context)
}

// Pre-configured child loggers for different modules
export const loggers = {
  // Core modules
  batchUpload: getLogger({
    module: 'batch-upload',
    service: 'youtube-automation',
  }),
  youtubeAuth: getLogger({
    module: 'youtube-auth',
    service: 'youtube-automation',
  }),
  verification: getLogger({
    module: 'verification',
    service: 'youtube-automation',
  }),

  // Processing modules
  videoSplit: getLogger({ module: 'video-split', service: 'video-processing' }),
  videoConcat: getLogger({
    module: 'video-concat',
    service: 'video-processing',
  }),
  audioExtract: getLogger({
    module: 'audio-extract',
    service: 'video-processing',
  }),
  transcribe: getLogger({ module: 'transcribe', service: 'ai-processing' }),

  // Content generation
  descriptionGen: getLogger({
    module: 'description-generation',
    service: 'ai-processing',
  }),
  batchGen: getLogger({
    module: 'batch-generation',
    service: 'content-management',
  }),

  // Testing
  mockServer: getLogger({ module: 'mock-server', service: 'testing' }),
}
