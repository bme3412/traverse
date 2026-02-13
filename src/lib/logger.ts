/**
 * Structured logging utility
 * Provides consistent error tracking and debugging across the application
 */

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";
  private isServer = typeof window === "undefined";

  /**
   * Formats a log entry for console output
   */
  private format(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.message,
    ];

    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(JSON.stringify(entry.context, null, 2));
    }

    if (entry.error) {
      parts.push(`\nError: ${entry.error.name}: ${entry.error.message}`);
      if (entry.error.stack) {
        parts.push(entry.error.stack);
      }
    }

    return parts.join(" ");
  }

  /**
   * Sends a log entry to the console or external service
   */
  private send(entry: LogEntry): void {
    // In development, always log to console with formatting
    if (this.isDevelopment) {
      const formatted = this.format(entry);
      switch (entry.level) {
        case LogLevel.DEBUG:
          console.debug(formatted);
          break;
        case LogLevel.INFO:
          console.info(formatted);
          break;
        case LogLevel.WARN:
          console.warn(formatted);
          break;
        case LogLevel.ERROR:
          console.error(formatted);
          break;
      }
      return;
    }

    // In production, you would send to a logging service here
    // Examples: Sentry, LogRocket, Datadog, etc.
    // For now, we'll just use console with minimal output
    if (entry.level === LogLevel.ERROR || entry.level === LogLevel.WARN) {
      console[entry.level](entry.message, entry.context);
    }
  }

  /**
   * Creates a log entry
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const entry: LogEntry = {
      level,
      message,
      context: {
        ...context,
        environment: this.isServer ? "server" : "client",
      },
      timestamp: new Date().toISOString(),
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
      };
    }

    this.send(entry);
  }

  /**
   * Debug level logging (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log(LogLevel.DEBUG, message, context);
    }
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  /**
   * Error level logging
   */
  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Logs an API request
   */
  apiRequest(method: string, path: string, context?: LogContext): void {
    this.info(`API ${method} ${path}`, {
      type: "api_request",
      method,
      path,
      ...context,
    });
  }

  /**
   * Logs an API response
   */
  apiResponse(method: string, path: string, status: number, duration: number): void {
    const level = status >= 500 ? LogLevel.ERROR : status >= 400 ? LogLevel.WARN : LogLevel.INFO;
    this.log(level, `API ${method} ${path} ${status}`, {
      type: "api_response",
      method,
      path,
      status,
      duration_ms: duration,
    });
  }

  /**
   * Logs agent execution
   */
  agentExecution(agent: string, action: string, context?: LogContext): void {
    this.debug(`Agent: ${agent} - ${action}`, {
      type: "agent_execution",
      agent,
      action,
      ...context,
    });
  }
}

// Export singleton instance
export const logger = new Logger();

/**
 * Helper to wrap async functions with error logging
 */
export function withErrorLogging<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: LogContext
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error(
        `Error in ${fn.name || "anonymous function"}`,
        context,
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }) as T;
}
