// src/logger.ts

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

class Logger {
  private level: LogLevel

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level
  }

  setLevel(level: LogLevel) {
    this.level = level
  }

  error(...args: any[]) {
    if (this.level >= LogLevel.ERROR) {
      console.error('[ERROR]', ...args)
    }
  }

  warn(...args: any[]) {
    if (this.level >= LogLevel.WARN) {
      console.warn('[WARN]', ...args)
    }
  }

  info(...args: any[]) {
    if (this.level >= LogLevel.INFO) {
      console.info('[INFO]', ...args)
    }
  }

  debug(...args: any[]) {
    if (this.level >= LogLevel.DEBUG) {
      console.debug('[DEBUG]', ...args)
    }
  }

  // Legacy console.log compatibility
  log(...args: any[]) {
    this.info(...args)
  }
}

// Global logger instance
export const logger = new Logger()

// Allow setting log level from environment
const envLogLevel = process.env['LOG_LEVEL']
if (envLogLevel) {
  const level = parseInt(envLogLevel, 10)
  if (!Number.isNaN(level) && level >= 0 && level <= 3) {
    logger.setLevel(level as LogLevel)
  }
}
