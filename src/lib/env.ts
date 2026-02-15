/**
 * Environment variable validation and access
 * Ensures required variables are set and provides type-safe access
 */

interface EnvConfig {
  ANTHROPIC_API_KEY: string;
  NODE_ENV: string;
}

class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentError';
  }
}

/**
 * Validates and returns required environment variables
 * Throws EnvironmentError if any required variable is missing
 */
function validateEnv(): EnvConfig {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey === 'your-api-key-here') {
    throw new EnvironmentError(
      'ANTHROPIC_API_KEY is not set. Please add your API key to .env.local\n' +
      'Get your API key from https://console.anthropic.com/'
    );
  }

  if (!apiKey.startsWith('sk-ant-')) {
    throw new EnvironmentError(
      'ANTHROPIC_API_KEY appears to be invalid. It should start with "sk-ant-"'
    );
  }

  return {
    ANTHROPIC_API_KEY: apiKey,
    NODE_ENV: process.env.NODE_ENV || 'development',
  };
}

// Validate on module load (server-side only)
let env: EnvConfig | null = null;

/**
 * Get validated environment configuration
 * Safe to call multiple times - validation only happens once
 */
export function getEnv(): EnvConfig {
  if (!env) {
    env = validateEnv();
  }
  return env;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
