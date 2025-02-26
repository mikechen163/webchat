export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function handleStreamError(error: unknown): never {
  if (error instanceof APIError) {
    throw error;
  }

  if (error instanceof Error) {
    throw new APIError(
      error.message,
      500,
      'STREAM_ERROR'
    );
  }

  throw new APIError(
    'An unknown error occurred',
    500,
    'UNKNOWN_ERROR'
  );
}
