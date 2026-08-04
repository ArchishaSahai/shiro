import { ProviderError, ShiroErrorCode } from "@shiro-sdk/core";

/**
 * Maps OpenAI SDK errors into Shiro provider errors.
 */
export class OpenAIErrorMapper {
  /**
   * Converts an unknown SDK error into a Shiro ProviderError.
   */
  map(error: unknown): ProviderError {
    if (error instanceof ProviderError) {
      return error;
    }

    const metadata = getErrorMetadata(error);
    const details = {
      cause: error,
      code: ShiroErrorCode.Provider,
      message: getErrorMessage(error),
    };

    return new ProviderError(metadata === undefined ? details : { ...details, metadata });
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `OpenAI provider failed: ${error.message}`;
  }

  return "OpenAI provider failed.";
}

function getErrorMetadata(error: unknown) {
  if (!isObject(error)) {
    return undefined;
  }

  const metadata: Record<string, string | number> = {};

  if (typeof error.status === "number") {
    metadata.status = error.status;
  }

  if (typeof error.code === "string") {
    metadata.code = error.code;
  }

  if (typeof error.type === "string") {
    metadata.type = error.type;
  }

  return Object.keys(metadata).length > 0 ? Object.freeze(metadata) : undefined;
}

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
