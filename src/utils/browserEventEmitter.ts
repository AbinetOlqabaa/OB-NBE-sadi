/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type Listener = (...args: any[]) => void;

/**
 * Browser-safe, isomorphic EventEmitter that works identically in both
 * browser (Vite SPA) and Node.js environments without requiring Node built-ins.
 */
export class BrowserSafeEventEmitter {
  private listeners: Map<string, Set<Listener>> = new Map();
  private maxListeners: number = 100;

  public setMaxListeners(n: number): this {
    this.maxListeners = n;
    return this;
  }

  public getMaxListeners(): number {
    return this.maxListeners;
  }

  public on(event: string, listener: Listener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  public addListener(event: string, listener: Listener): this {
    return this.on(event, listener);
  }

  public once(event: string, listener: Listener): this {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      listener(...args);
    };
    (onceWrapper as any)._originalListener = listener;
    return this.on(event, onceWrapper);
  }

  public off(event: string, listener: Listener): this {
    const set = this.listeners.get(event);
    if (!set) return this;
    for (const l of set) {
      if (l === listener || (l as any)._originalListener === listener) {
        set.delete(l);
      }
    }
    if (set.size === 0) {
      this.listeners.delete(event);
    }
    return this;
  }

  public removeListener(event: string, listener: Listener): this {
    return this.off(event, listener);
  }

  public removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  public emit(event: string, ...args: any[]): boolean {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return false;
    const list = Array.from(set);
    for (const listener of list) {
      try {
        listener(...args);
      } catch (err) {
        console.error(`[EventEmitter] Error executing listener for "${event}":`, err);
      }
    }
    return true;
  }

  public listenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }
}

export const EventEmitter = BrowserSafeEventEmitter;
export default BrowserSafeEventEmitter;
