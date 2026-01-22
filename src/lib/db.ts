import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { Pool, PoolConfig } from 'pg';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * PrismaPg adapter options (recreated as the type is not exported from adapter-pg)
 */
interface PrismaPgAdapterOptions {
  schema?: string;
  disposeExternalPool?: boolean;
  onPoolError?: (err: Error) => void;
  onConnectionError?: (err: Error) => void;
}

// ============================================================================
// Environment Configuration
// ============================================================================

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// ============================================================================
// Connection Pool Configuration
// ============================================================================

/**
 * PostgreSQL connection pool configuration
 * Optimized for serverless environments and production workloads
 */
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Connection pool limits
  max: isProduction ? 20 : 10, // Max connections in pool
  min: isProduction ? 5 : 2, // Min connections to maintain
  // Connection timeouts
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Fail if can't connect in 10s
  // Statement timeout for long-running queries
  statement_timeout: 60000, // 60 second query timeout
  // Application name for monitoring
  application_name: 'samus-platform',
};

// Create the connection pool
const pool = new Pool(poolConfig);

// ============================================================================
// Pool Error Handling
// ============================================================================

/**
 * Global pool error handler
 * Handles connection errors at the pool level
 */
pool.on('error', (err: Error) => {
  console.error('[Prisma Pool] Unexpected error on idle client:', err.message);
  // In production, you might want to send this to error monitoring service
  if (isProduction) {
    // Could integrate with Sentry, DataDog, etc.
    console.error('[Prisma Pool] Stack trace:', err.stack);
  }
});

pool.on('connect', () => {
  if (isDevelopment) {
    console.log('[Prisma Pool] New client connected to database');
  }
});

pool.on('remove', () => {
  if (isDevelopment) {
    console.log('[Prisma Pool] Client removed from pool');
  }
});

// ============================================================================
// Prisma Adapter Configuration
// ============================================================================

/**
 * PrismaPg adapter options
 */
const adapterOptions: PrismaPgAdapterOptions = {
  // Use external pool management
  disposeExternalPool: false,
  // Pool-level error handling
  onPoolError: (err: Error) => {
    console.error('[Prisma Adapter] Pool error:', err.message);
  },
  // Connection-level error handling
  onConnectionError: (err: Error) => {
    console.error('[Prisma Adapter] Connection error:', err.message);
  },
};

// ============================================================================
// Prisma Client Configuration
// ============================================================================

/**
 * Prisma log levels configuration
 * Development: verbose logging for debugging
 * Production: minimal logging for performance
 */
const getLogConfig = (): Prisma.LogLevel[] => {
  if (isDevelopment) {
    return ['query', 'info', 'warn', 'error'];
  }
  return ['error'];
};

/**
 * Extended log configuration with event handlers
 */
const getLogDefinition = (): Prisma.LogDefinition[] => {
  if (isDevelopment) {
    return [
      { level: 'query', emit: 'event' },
      { level: 'info', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
      { level: 'error', emit: 'stdout' },
    ];
  }
  return [{ level: 'error', emit: 'stdout' }];
};

// ============================================================================
// Singleton Pattern Implementation
// ============================================================================

/**
 * Global singleton storage for Prisma client
 * Prevents multiple instances in development hot-reload scenarios
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

/**
 * Creates and configures the Prisma client instance
 */
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg(pool, adapterOptions);

  const client = new PrismaClient({
    adapter,
    log: getLogDefinition(),
    // Error formatting for development
    errorFormat: isDevelopment ? 'pretty' : 'minimal',
  });

  return client;
}

// ============================================================================
// Prisma Client Export
// ============================================================================

/**
 * Singleton Prisma client instance
 * Uses global storage to prevent multiple instances during development hot-reload
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Store in global for development hot-reload
if (!isProduction) {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}

// ============================================================================
// Database Error Handling Utilities
// ============================================================================

/**
 * Custom database error class for better error handling
 */
export class DatabaseError extends Error {
  public readonly code: string;
  public readonly meta?: Record<string, unknown>;
  public readonly isRetryable: boolean;

  constructor(message: string, code: string, meta?: Record<string, unknown>, isRetryable = false) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.meta = meta;
    this.isRetryable = isRetryable;
  }
}

/**
 * Prisma error codes that indicate retryable errors
 */
const RETRYABLE_ERROR_CODES = new Set([
  'P1001', // Can't reach database server
  'P1002', // Database server timed out
  'P1008', // Operations timed out
  'P1017', // Server closed connection
  'P2024', // Timed out fetching from connection pool
  'P2034', // Transaction failed due to conflict
]);

/**
 * Maps Prisma errors to DatabaseError for consistent handling
 */
export function handleDatabaseError(error: unknown): DatabaseError {
  // Handle Prisma known request errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const isRetryable = RETRYABLE_ERROR_CODES.has(error.code);
    return new DatabaseError(error.message, error.code, error.meta as Record<string, unknown>, isRetryable);
  }

  // Handle Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    return new DatabaseError('Database validation error: ' + error.message, 'VALIDATION_ERROR', undefined, false);
  }

  // Handle Prisma initialization errors
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new DatabaseError(
      'Database initialization error: ' + error.message,
      error.errorCode ?? 'INIT_ERROR',
      undefined,
      true // Initialization errors are often transient
    );
  }

  // Handle Prisma Rust panic errors
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return new DatabaseError('Database engine panic: ' + error.message, 'ENGINE_PANIC', undefined, false);
  }

  // Handle Prisma unknown request errors
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return new DatabaseError(
      'Unknown database error: ' + error.message,
      'UNKNOWN_ERROR',
      undefined,
      true // Unknown errors might be transient
    );
  }

  // Handle generic errors
  if (error instanceof Error) {
    return new DatabaseError(error.message, 'GENERIC_ERROR', undefined, false);
  }

  // Handle non-Error objects
  return new DatabaseError('An unexpected database error occurred', 'UNEXPECTED_ERROR', undefined, false);
}

/**
 * Wraps a database operation with error handling
 * Returns a standardized result object
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>
): Promise<{ success: true; data: T } | { success: false; error: DatabaseError }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const dbError = handleDatabaseError(error);

    // Log errors in development
    if (isDevelopment) {
      console.error('[Database Error]', {
        code: dbError.code,
        message: dbError.message,
        meta: dbError.meta,
        isRetryable: dbError.isRetryable,
      });
    }

    return { success: false, error: dbError };
  }
}

/**
 * Retries a database operation with exponential backoff
 */
export async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3, baseDelayMs = 100): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const dbError = handleDatabaseError(error);

      // Only retry if the error is retryable
      if (!dbError.isRetryable || attempt === maxRetries - 1) {
        throw dbError;
      }

      // Exponential backoff with jitter
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100;

      if (isDevelopment) {
        console.log(
          `[Database] Retrying operation (attempt ${attempt + 1}/${maxRetries}) after ${Math.round(delay)}ms`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw handleDatabaseError(lastError);
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

/**
 * Gracefully disconnects from the database
 * Should be called during application shutdown
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    await pool.end();
    if (isDevelopment) {
      console.log('[Prisma] Disconnected from database');
    }
  } catch (error) {
    console.error('[Prisma] Error during disconnect:', error);
  }
}

// Handle process signals for graceful shutdown
if (typeof process !== 'undefined') {
  const handleShutdown = async (signal: string) => {
    console.log(`[Prisma] Received ${signal}, shutting down gracefully...`);
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

// ============================================================================
// Connection Health Check
// ============================================================================

/**
 * Checks database connection health
 * Useful for health check endpoints
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;

    return {
      healthy: true,
      latencyMs,
    };
  } catch (error) {
    const dbError = handleDatabaseError(error);

    return {
      healthy: false,
      error: dbError.message,
    };
  }
}

// ============================================================================
// Pool Statistics (Development Only)
// ============================================================================

/**
 * Returns current connection pool statistics
 * Only available in development mode
 */
export function getPoolStats(): {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
} | null {
  if (!isDevelopment) {
    return null;
  }

  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}
