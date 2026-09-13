/**
 * The slice of the extension platform Music Timer actually uses.
 *
 * Hand-written on purpose: it keeps the project dependency-free, and it doubles as a
 * written record of our platform surface. Anything not declared here is something we have
 * decided not to depend on - adding to this file should be a conscious act, not a side
 * effect of autocomplete.
 */

declare namespace chrome {
  namespace storage {
    interface StorageArea {
      /** MV3 returns a promise when no callback is passed. */
      get(keys: string | string[] | null): Promise<Record<string, any>>;
      set(items: Record<string, any>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    }
    /** Durable, survives browser restart. */
    const local: StorageArea;
    /** Cleared when the browser closes - correct home for live tab reports. */
    const session: StorageArea;
  }

  namespace action {
    function setBadgeText(details: { text: string; tabId?: number }): Promise<void>;
    function setBadgeBackgroundColor(details: { color: string; tabId?: number }): Promise<void>;
  }

  namespace runtime {
    interface MessageSender {
      tab?: { id?: number; url?: string };
      id?: string;
      url?: string;
    }

    /** Set inside a sendMessage callback when delivery failed; undefined otherwise. */
    const lastError: { message?: string } | undefined;

    function sendMessage(message: any, responseCallback?: (response: any) => void): void;

    const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: MessageSender,
          sendResponse: (response?: any) => void
        ) => boolean | void
      ): void;
    };

    const onStartup: { addListener(callback: () => void | Promise<void>): void };
    const onInstalled: { addListener(callback: (details?: any) => void): void };

    /** Only the slice of manifest.json backfillExistingTabs() actually reads. */
    interface Manifest {
      content_scripts?: { matches: string[]; js: string[] }[];
    }
    function getManifest(): Manifest;
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
    }

    const onRemoved: {
      addListener(
        callback: (tabId: number, removeInfo?: { windowId: number; isWindowClosing: boolean }) => void
      ): void;
    };

    /** `url` filters by match pattern; requires host permission for those patterns. */
    function query(queryInfo: { url?: string[] }): Promise<Tab[]>;
  }

  namespace scripting {
    interface ScriptInjection {
      target: { tabId: number; allFrames?: boolean };
      files: string[];
    }
    function executeScript(injection: ScriptInjection): Promise<any>;
  }

  namespace alarms {
    interface Alarm {
      name: string;
      scheduledTime: number;
      periodInMinutes?: number;
    }
    function create(name: string, alarmInfo: { periodInMinutes?: number; delayInMinutes?: number; when?: number }): void;
    const onAlarm: { addListener(callback: (alarm: Alarm) => void): void };
  }
}

/** Available in a classic service worker; the test harness stubs it. */
declare function importScripts(...urls: string[]): void;
