import { writeTextFile, BaseDirectory, exists, mkdir } from '@tauri-apps/plugin-fs'

interface LogEntry {
  timestamp: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  component: string
  message: string
  data?: Record<string, unknown>
}

class Logger {
  private logBuffer: LogEntry[] = []
  private flushInterval: number | null = null
  private readonly FLUSH_INTERVAL_MS = 1000
  private readonly MAX_BUFFER_SIZE = 100

  constructor() {
    this.initLogDirectory()
    this.startFlushTimer()
  }

  private async initLogDirectory(): Promise<void> {
    try {
      const logsExist = await exists('logs', { baseDir: BaseDirectory.AppLog })
      if (!logsExist) {
        await mkdir('logs', { baseDir: BaseDirectory.AppLog, recursive: true })
      }
    } catch (error) {
      console.error('ログディレクトリの初期化に失敗:', error)
    }
  }

  private startFlushTimer(): void {
    if (this.flushInterval !== null) {
      clearInterval(this.flushInterval)
    }

    this.flushInterval = window.setInterval(() => {
      this.flush()
    }, this.FLUSH_INTERVAL_MS)
  }

  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return

    const logsToWrite = [...this.logBuffer]
    this.logBuffer = []

    try {
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `scroll-debug-${timestamp}.log`

      const logText = logsToWrite
        .map(entry => {
          const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
          return `[${entry.timestamp}] [${entry.level}] [${entry.component}] ${entry.message}${dataStr}`
        })
        .join('\n') + '\n'

      await writeTextFile(`logs/${filename}`, logText, {
        baseDir: BaseDirectory.AppLog,
        append: true,
      })
    } catch (error) {
      console.error('ログの書き込みに失敗:', error)
    }
  }

  private log(level: LogEntry['level'], component: string, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data,
    }

    this.logBuffer.push(entry)

    // バッファが大きくなりすぎたら即座にフラッシュ
    if (this.logBuffer.length >= this.MAX_BUFFER_SIZE) {
      this.flush()
    }

    // 開発中はコンソールにも出力（本番では削除可能）
    if (import.meta.env.MODE === 'development') {
      if (data) {
        console.log(`[${component}] ${message}`, data)
      } else {
        console.log(`[${component}] ${message}`)
      }
    }
  }

  debug(component: string, message: string, data?: Record<string, unknown>): void {
    this.log('DEBUG', component, message, data)
  }

  info(component: string, message: string, data?: Record<string, unknown>): void {
    this.log('INFO', component, message, data)
  }

  warn(component: string, message: string, data?: Record<string, unknown>): void {
    this.log('WARN', component, message, data)
  }

  error(component: string, message: string, data?: Record<string, unknown>): void {
    this.log('ERROR', component, message, data)
  }

  async destroy(): Promise<void> {
    if (this.flushInterval !== null) {
      clearInterval(this.flushInterval)
    }
    await this.flush()
  }
}

export const logger = new Logger()
