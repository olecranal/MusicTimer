/**
 * Globals that src/shared/* installs. These are classic scripts rather than ES modules
 * (see the header of src/shared/logger.js for why), so the things they define arrive as
 * globals and have to be declared for the checker to see them.
 */

interface MtLog {
  debug(event: string, context?: Record<string, unknown>): void;
  info(event: string, context?: Record<string, unknown>): void;
  warn(event: string, context?: Record<string, unknown>): void;
  error(event: string, context?: Record<string, unknown>): void;
  /**
   * Report a persistent condition once per key, for paths a poll can reach.
   * @param key stable identity of the condition, not the message
   */
  warnOnce(key: string, event: string, context?: Record<string, unknown>): void;
}

type MtLogLevel = "debug" | "info" | "warn" | "error" | "silent";

interface MtLoggerFactory {
  (scope: string): MtLog;
  setLevel(level: MtLogLevel): void;
  installGlobalErrorHandlers(scope: string): void;
}

interface MtContract {
  MESSAGE: {
    /** content script -> worker, a playback report */
    STATE: string;
    /** popup -> worker, fetch a snapshot */
    GET: string;
    /** popup -> worker, mutate then snapshot */
    COMMAND: string;
  };
  ACTION: {
    START: string;
    STOP: string;
    RESET: string;
    SET_MODE: string;
    SET_FILTER: string;
    CLEAR_FILTER: string;
    SELECT_TIMER: string;
    ADD_TIMER: string;
    RENAME_TIMER: string;
    DELETE_TIMER: string;
  };
}

declare var mtLogger: MtLoggerFactory;
declare var MT: MtContract;
/** Read once by logger.js at load; the test harness sets it to keep output readable. */
declare var MT_LOG_LEVEL: MtLogLevel | undefined;
