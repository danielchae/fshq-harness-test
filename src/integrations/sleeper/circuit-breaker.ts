/**
 * Circuit Breaker Pattern for Sleeper API Integration (task-61)
 *
 * Provides resilience for Sleeper API calls with:
 * - Circuit opens after 5 consecutive failures
 * - Half-open state after 30 second cooldown
 * - Exponential backoff with jitter for retries
 * - Fallback to cached data when circuit open
 */

// ============================================================================
// Configuration
// ============================================================================

/** Number of consecutive failures before circuit opens */
const FAILURE_THRESHOLD = 5;

/** Cooldown period before transitioning to half-open (30 seconds) */
const COOLDOWN_MS = 30 * 1000;

/** Number of successful requests needed in half-open to close circuit */
const SUCCESS_THRESHOLD = 2;

/** Base delay for exponential backoff (in ms) */
const BASE_BACKOFF_DELAY_MS = 100;

/** Maximum backoff delay (30 seconds) */
const MAX_BACKOFF_DELAY_MS = 30 * 1000;

/** Maximum retry attempts */
const MAX_RETRY_ATTEMPTS = 3;

// ============================================================================
// Types
// ============================================================================

/** Circuit breaker states */
export type CircuitState = 'closed' | 'open' | 'half-open';

/** Circuit breaker configuration options */
export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Cooldown period in ms before half-open (default: 30000) */
  cooldownMs?: number;
  /** Number of successes in half-open to close (default: 2) */
  successThreshold?: number;
  /** Callback when circuit state changes */
  onStateChange?: (oldState: CircuitState, newState: CircuitState, endpoint: string) => void;
}

/** Internal circuit breaker state */
interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastStateChange: number;
  options: Required<Omit<CircuitBreakerOptions, 'onStateChange'>> & {
    onStateChange?: CircuitBreakerOptions['onStateChange'];
  };
}

/** Result of a circuit-protected operation */
export interface CircuitBreakerResult<T> {
  success: boolean;
  data?: T;
  fromCache?: boolean;
  circuitState: CircuitState;
  error?: string;
  errorCode?: 'CIRCUIT_OPEN' | 'EXECUTION_ERROR' | 'NO_FALLBACK';
}

/** Fetch function signature for circuit breaker wrapper */
export type FetchFunction<T> = () => Promise<T>;

/** Fallback function signature for cached data */
export type FallbackFunction<T> = () => T | null;

// ============================================================================
// Circuit Breaker Registry
// ============================================================================

/**
 * Per-endpoint circuit breakers
 * Each endpoint has its own independent circuit breaker state
 */
const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * State change listeners for monitoring
 */
const stateChangeListeners: ((endpoint: string, oldState: CircuitState, newState: CircuitState) => void)[] = [];

/**
 * Get or create circuit breaker state for an endpoint
 */
function getCircuitBreaker(endpoint: string, options: CircuitBreakerOptions = {}): CircuitBreakerState {
  let breaker = circuitBreakers.get(endpoint);

  if (!breaker) {
    breaker = {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      lastStateChange: Date.now(),
      options: {
        failureThreshold: options.failureThreshold ?? FAILURE_THRESHOLD,
        cooldownMs: options.cooldownMs ?? COOLDOWN_MS,
        successThreshold: options.successThreshold ?? SUCCESS_THRESHOLD,
        onStateChange: options.onStateChange,
      },
    };
    circuitBreakers.set(endpoint, breaker);
  }

  return breaker;
}

// ============================================================================
// State Transitions
// ============================================================================

/**
 * Transition circuit to a new state
 */
function transitionState(breaker: CircuitBreakerState, newState: CircuitState, endpoint: string): void {
  const oldState = breaker.state;

  if (oldState === newState) {
    return;
  }

  breaker.state = newState;
  breaker.lastStateChange = Date.now();

  // Reset counters on state change
  if (newState === 'closed') {
    breaker.failureCount = 0;
    breaker.successCount = 0;
  } else if (newState === 'half-open') {
    breaker.successCount = 0;
  }

  // Log state transition
  console.log(`[CircuitBreaker] ${endpoint}: ${oldState} -> ${newState}`);

  // Notify callback
  if (breaker.options.onStateChange) {
    breaker.options.onStateChange(oldState, newState, endpoint);
  }

  // Notify global listeners
  for (const listener of stateChangeListeners) {
    try {
      listener(endpoint, oldState, newState);
    } catch (error) {
      console.error('[CircuitBreaker] Error in state change listener:', error);
    }
  }
}

/**
 * Check and update circuit state based on cooldown
 * Transitions from open to half-open after cooldown period
 */
function checkState(breaker: CircuitBreakerState, endpoint: string): CircuitState {
  if (breaker.state === 'open') {
    const now = Date.now();
    const timeSinceFailure = now - breaker.lastFailureTime;

    if (timeSinceFailure >= breaker.options.cooldownMs) {
      transitionState(breaker, 'half-open', endpoint);
    }
  }

  return breaker.state;
}

/**
 * Record a failure for the circuit breaker
 */
function recordFailure(breaker: CircuitBreakerState, endpoint: string): void {
  breaker.failureCount++;
  breaker.lastFailureTime = Date.now();

  if (breaker.state === 'half-open') {
    // Single failure in half-open reopens the circuit
    transitionState(breaker, 'open', endpoint);
  } else if (breaker.state === 'closed') {
    // Check if we've hit the threshold
    if (breaker.failureCount >= breaker.options.failureThreshold) {
      transitionState(breaker, 'open', endpoint);
    }
  }
}

/**
 * Record a success for the circuit breaker
 */
function recordSuccess(breaker: CircuitBreakerState, endpoint: string): void {
  if (breaker.state === 'half-open') {
    breaker.successCount++;

    if (breaker.successCount >= breaker.options.successThreshold) {
      transitionState(breaker, 'closed', endpoint);
    }
  } else if (breaker.state === 'closed') {
    // Reset failure count on success
    breaker.failureCount = 0;
  }
}

// ============================================================================
// Exponential Backoff with Jitter
// ============================================================================

/**
 * Calculate delay with exponential backoff and jitter
 *
 * Formula: min(baseDelay * 2^attempt + jitter, maxDelay)
 * Jitter adds randomness to prevent thundering herd
 *
 * @param attempt - Current retry attempt (0-indexed)
 * @param baseDelay - Base delay in milliseconds (default: 100ms)
 * @param maxDelay - Maximum delay cap (default: 30 seconds)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number = BASE_BACKOFF_DELAY_MS,
  maxDelay: number = MAX_BACKOFF_DELAY_MS
): number {
  // Exponential delay: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Add jitter: random value between 0 and baseDelay
  const jitter = Math.random() * baseDelay;

  // Cap at max delay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Main Circuit Breaker Function
// ============================================================================

/**
 * Execute a function with circuit breaker protection
 *
 * Features:
 * - Circuit opens after consecutive failures (default: 5)
 * - Half-open state after cooldown (default: 30s)
 * - Falls back to cached data when circuit is open
 * - Exponential backoff with jitter for retries
 *
 * @param endpoint - Unique identifier for the endpoint (e.g., '/league/123')
 * @param fetchFn - Function that performs the actual fetch
 * @param fallbackFn - Optional function that returns cached data
 * @param options - Circuit breaker configuration options
 * @returns CircuitBreakerResult with data or error information
 */
export async function withCircuitBreaker<T>(
  endpoint: string,
  fetchFn: FetchFunction<T>,
  fallbackFn?: FallbackFunction<T>,
  options: CircuitBreakerOptions = {}
): Promise<CircuitBreakerResult<T>> {
  const breaker = getCircuitBreaker(endpoint, options);
  const currentState = checkState(breaker, endpoint);

  // If circuit is open, try fallback immediately
  if (currentState === 'open') {
    if (fallbackFn) {
      const cachedData = fallbackFn();
      if (cachedData !== null) {
        return {
          success: true,
          data: cachedData,
          fromCache: true,
          circuitState: 'open',
        };
      }
    }

    // No fallback available
    return {
      success: false,
      circuitState: 'open',
      error: 'Circuit breaker is open and no cached data available',
      errorCode: 'CIRCUIT_OPEN',
    };
  }

  // Attempt to execute the function
  try {
    const result = await fetchFn();
    recordSuccess(breaker, endpoint);

    return {
      success: true,
      data: result,
      fromCache: false,
      circuitState: breaker.state,
    };
  } catch (error) {
    recordFailure(breaker, endpoint);

    // If circuit just opened, try fallback
    if (breaker.state === 'open' && fallbackFn) {
      const cachedData = fallbackFn();
      if (cachedData !== null) {
        return {
          success: true,
          data: cachedData,
          fromCache: true,
          circuitState: 'open',
        };
      }
    }

    return {
      success: false,
      circuitState: breaker.state,
      error: error instanceof Error ? error.message : String(error),
      errorCode: breaker.state === 'open' ? 'CIRCUIT_OPEN' : 'EXECUTION_ERROR',
    };
  }
}

/**
 * Execute a function with circuit breaker protection and retry logic
 *
 * Combines circuit breaker with exponential backoff retry for maximum resilience.
 *
 * @param endpoint - Unique identifier for the endpoint
 * @param fetchFn - Function that performs the actual fetch
 * @param fallbackFn - Optional function that returns cached data
 * @param options - Circuit breaker and retry configuration
 * @returns CircuitBreakerResult with data or error information
 */
export async function withCircuitBreakerAndRetry<T>(
  endpoint: string,
  fetchFn: FetchFunction<T>,
  fallbackFn?: FallbackFunction<T>,
  options: CircuitBreakerOptions & { maxRetries?: number } = {}
): Promise<CircuitBreakerResult<T>> {
  const maxRetries = options.maxRetries ?? MAX_RETRY_ATTEMPTS;
  const breaker = getCircuitBreaker(endpoint, options);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const currentState = checkState(breaker, endpoint);

    // If circuit is open, try fallback
    if (currentState === 'open') {
      if (fallbackFn) {
        const cachedData = fallbackFn();
        if (cachedData !== null) {
          return {
            success: true,
            data: cachedData,
            fromCache: true,
            circuitState: 'open',
          };
        }
      }

      return {
        success: false,
        circuitState: 'open',
        error: 'Circuit breaker is open and no cached data available',
        errorCode: 'CIRCUIT_OPEN',
      };
    }

    try {
      const result = await fetchFn();
      recordSuccess(breaker, endpoint);

      return {
        success: true,
        data: result,
        fromCache: false,
        circuitState: breaker.state,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      recordFailure(breaker, endpoint);

      // Check if circuit just opened
      if (breaker.state === 'open') {
        // Try fallback before giving up
        if (fallbackFn) {
          const cachedData = fallbackFn();
          if (cachedData !== null) {
            return {
              success: true,
              data: cachedData,
              fromCache: true,
              circuitState: 'open',
            };
          }
        }

        return {
          success: false,
          circuitState: 'open',
          error: lastError.message,
          errorCode: 'CIRCUIT_OPEN',
        };
      }

      // Wait before retrying (if not last attempt)
      if (attempt < maxRetries) {
        const delay = calculateBackoffDelay(attempt);
        console.warn(
          `[CircuitBreaker] ${endpoint}: Retry ${attempt + 1}/${maxRetries + 1} after ${Math.round(delay)}ms`
        );
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  return {
    success: false,
    circuitState: breaker.state,
    error: lastError?.message || 'Max retries exceeded',
    errorCode: 'EXECUTION_ERROR',
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the current state of a circuit breaker
 */
export function getCircuitState(endpoint: string): CircuitState {
  const breaker = circuitBreakers.get(endpoint);
  if (!breaker) {
    return 'closed';
  }
  return checkState(breaker, endpoint);
}

/**
 * Get detailed circuit breaker status for an endpoint
 */
export function getCircuitStatus(endpoint: string): {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastStateChange: number;
  timeSinceLastFailure: number;
  timeSinceStateChange: number;
} | null {
  const breaker = circuitBreakers.get(endpoint);
  if (!breaker) {
    return null;
  }

  checkState(breaker, endpoint);
  const now = Date.now();

  return {
    state: breaker.state,
    failureCount: breaker.failureCount,
    successCount: breaker.successCount,
    lastFailureTime: breaker.lastFailureTime,
    lastStateChange: breaker.lastStateChange,
    timeSinceLastFailure: breaker.lastFailureTime > 0 ? now - breaker.lastFailureTime : 0,
    timeSinceStateChange: now - breaker.lastStateChange,
  };
}

/**
 * Get all circuit breaker statuses for monitoring
 */
export function getAllCircuitStatuses(): Map<
  string,
  {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
  }
> {
  const statuses = new Map<
    string,
    {
      state: CircuitState;
      failureCount: number;
      successCount: number;
      lastFailureTime: number;
    }
  >();

  circuitBreakers.forEach((breaker, endpoint) => {
    checkState(breaker, endpoint);
    statuses.set(endpoint, {
      state: breaker.state,
      failureCount: breaker.failureCount,
      successCount: breaker.successCount,
      lastFailureTime: breaker.lastFailureTime,
    });
  });

  return statuses;
}

/**
 * Manually reset a circuit breaker to closed state
 */
export function resetCircuit(endpoint: string): void {
  const breaker = circuitBreakers.get(endpoint);
  if (breaker) {
    transitionState(breaker, 'closed', endpoint);
    breaker.failureCount = 0;
    breaker.successCount = 0;
    console.log(`[CircuitBreaker] ${endpoint}: Manually reset to closed`);
  }
}

/**
 * Reset all circuit breakers to closed state
 */
export function resetAllCircuits(): void {
  circuitBreakers.forEach((breaker, endpoint) => {
    transitionState(breaker, 'closed', endpoint);
    breaker.failureCount = 0;
    breaker.successCount = 0;
  });
  console.log('[CircuitBreaker] All circuits reset to closed');
}

/**
 * Remove a circuit breaker (useful for cleanup)
 */
export function removeCircuit(endpoint: string): void {
  circuitBreakers.delete(endpoint);
}

/**
 * Clear all circuit breakers (useful for testing)
 */
export function clearAllCircuits(): void {
  circuitBreakers.clear();
}

/**
 * Add a state change listener for monitoring
 */
export function addStateChangeListener(
  listener: (endpoint: string, oldState: CircuitState, newState: CircuitState) => void
): () => void {
  stateChangeListeners.push(listener);

  // Return unsubscribe function
  return () => {
    const index = stateChangeListeners.indexOf(listener);
    if (index !== -1) {
      stateChangeListeners.splice(index, 1);
    }
  };
}

// ============================================================================
// Pre-configured Endpoint Helpers
// ============================================================================

/**
 * Get circuit breaker endpoint key for Sleeper league
 */
export function getLeagueEndpoint(leagueId: string): string {
  return `/league/${leagueId}`;
}

/**
 * Get circuit breaker endpoint key for Sleeper rosters
 */
export function getRostersEndpoint(leagueId: string): string {
  return `/league/${leagueId}/rosters`;
}

/**
 * Get circuit breaker endpoint key for Sleeper matchups
 */
export function getMatchupsEndpoint(leagueId: string, week: number): string {
  return `/league/${leagueId}/matchups/${week}`;
}

/**
 * Get circuit breaker endpoint key for Sleeper transactions
 */
export function getTransactionsEndpoint(leagueId: string, round: number): string {
  return `/league/${leagueId}/transactions/${round}`;
}

/**
 * Get circuit breaker endpoint key for Sleeper players
 */
export function getPlayersEndpoint(): string {
  return '/players/nfl';
}

/**
 * Get circuit breaker endpoint key for NFL state
 */
export function getNFLStateEndpoint(): string {
  return '/state/nfl';
}

// ============================================================================
// Exports
// ============================================================================

export {
  FAILURE_THRESHOLD,
  COOLDOWN_MS,
  SUCCESS_THRESHOLD,
  BASE_BACKOFF_DELAY_MS,
  MAX_BACKOFF_DELAY_MS,
  MAX_RETRY_ATTEMPTS,
};
