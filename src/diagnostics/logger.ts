const TOKEN_PATTERN = /([?&](?:token|feedToken)=)[^&#\s]+/gi;

export function redactSecrets(value: unknown): string {
  return String(value ?? "").replace(TOKEN_PATTERN, "$1[REDACTED]");
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return redactSecrets(error.message);
  return redactSecrets(error);
}

export const logger = {
  info(message: string, ...details: unknown[]): void {
    console.info(redactSecrets(message), ...details.map(redactSecrets));
  },
  warn(message: string, ...details: unknown[]): void {
    console.warn(redactSecrets(message), ...details.map(redactSecrets));
  },
  error(message: string, ...details: unknown[]): void {
    console.error(redactSecrets(message), ...details.map(redactSecrets));
  },
};
