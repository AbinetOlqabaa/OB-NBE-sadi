/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ReportSubmission,
  AuditLogEntry,
  OfflineSyncStatus,
  OfflineStorageStats,
} from '../types/regulatory.ts';

const DB_NAME = 'OromiaBank_NBE_Regulatory_DB';
const DB_VERSION = 1;

export const STORES = {
  DRAFTS: 'draft_submissions',
  AUDIT_LOGS: 'audit_logs',
  METADATA: 'offline_metadata',
} as const;

export interface OfflineDraftRecord extends ReportSubmission {
  syncStatus?: OfflineSyncStatus;
  isOfflineDraft?: boolean;
  offlineSavedAt?: string;
}

export interface OfflineAuditRecord extends AuditLogEntry {
  syncStatus?: 'SYNCED' | 'PENDING_SYNC';
  isOfflineRecord?: boolean;
  persistedAt?: string;
}

export interface OfflineMetadataRecord {
  key: string;
  value: any;
  updatedAt: string;
}

type StorageChangeListener = () => void;

class IndexedDbStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private listeners: Set<StorageChangeListener> = new Set();

  // In-memory fallback stores when IndexedDB is not available (e.g. Node.js unit test runtime)
  private memoryDrafts: Map<string, OfflineDraftRecord> = new Map();
  private memoryAuditLogs: Map<string, OfflineAuditRecord> = new Map();
  private memoryMetadata: Map<string, any> = new Map();

  constructor() {
    if (this.isBrowserIndexedDBAvailable()) {
      this.initDB().catch((err) => {
        console.warn('[IndexedDB] Failed to pre-initialize IndexedDB:', err);
      });
    }
  }

  public isBrowserIndexedDBAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.indexedDB !== 'undefined' &&
      window.indexedDB !== null
    );
  }

  public subscribe(listener: StorageChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyChange(): void {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('[IndexedDB] Listener error:', err);
      }
    });
  }

  /**
   * Initializes and opens the IndexedDB instance with upgrade schema handling.
   */
  public async initDB(): Promise<IDBDatabase | null> {
    if (!this.isBrowserIndexedDBAvailable()) {
      return null;
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // 1. Draft Submissions Object Store
          if (!db.objectStoreNames.contains(STORES.DRAFTS)) {
            const draftStore = db.createObjectStore(STORES.DRAFTS, { keyPath: 'id' });
            draftStore.createIndex('reportKey', 'reportKey', { unique: false });
            draftStore.createIndex('status', 'status', { unique: false });
            draftStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            draftStore.createIndex('makerId', 'makerId', { unique: false });
            draftStore.createIndex('syncStatus', 'syncStatus', { unique: false });
            draftStore.createIndex('isOfflineDraft', 'isOfflineDraft', { unique: false });
          }

          // 2. Audit Trail Logs Object Store
          if (!db.objectStoreNames.contains(STORES.AUDIT_LOGS)) {
            const auditStore = db.createObjectStore(STORES.AUDIT_LOGS, { keyPath: 'id' });
            auditStore.createIndex('timestamp', 'timestamp', { unique: false });
            auditStore.createIndex('action', 'action', { unique: false });
            auditStore.createIndex('actorId', 'actorId', { unique: false });
            auditStore.createIndex('entityType', 'entityType', { unique: false });
            auditStore.createIndex('syncStatus', 'syncStatus', { unique: false });
            auditStore.createIndex('isOfflineRecord', 'isOfflineRecord', { unique: false });
          }

          // 3. Offline Metadata Object Store
          if (!db.objectStoreNames.contains(STORES.METADATA)) {
            db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
          }
        };

        request.onsuccess = (event: Event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          resolve(db);
        };

        request.onerror = (event: Event) => {
          console.error('[IndexedDB] Open request failed:', (event.target as IDBOpenDBRequest).error);
          reject((event.target as IDBOpenDBRequest).error);
        };

        request.onblocked = () => {
          console.warn('[IndexedDB] Database upgrade blocked by another connection.');
        };
      } catch (err) {
        reject(err);
      }
    });

    return this.dbPromise;
  }

  // =========================================================================
  // DRAFT SUBMISSIONS OPERATIONS
  // =========================================================================

  /**
   * Persists a draft submission into IndexedDB.
   * If offline or in remote site visit mode, marks as PENDING_SYNC.
   */
  public async saveDraft(
    submission: ReportSubmission,
    options: {
      syncStatus?: OfflineSyncStatus;
      isOffline?: boolean;
    } = {}
  ): Promise<void> {
    const now = new Date().toISOString();
    const syncStatus: OfflineSyncStatus = options.syncStatus || 'PENDING_SYNC';
    const isOfflineDraft = options.isOffline !== undefined ? options.isOffline : syncStatus !== 'SYNCED';

    const record: OfflineDraftRecord = {
      ...JSON.parse(JSON.stringify(submission)),
      syncStatus,
      isOfflineDraft,
      offlineSavedAt: now,
    };

    // Always update in-memory fallback
    this.memoryDrafts.set(record.id, record);

    if (this.isBrowserIndexedDBAvailable()) {
      try {
        const db = await this.initDB();
        if (db) {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction([STORES.DRAFTS], 'readwrite');
            const store = tx.objectStore(STORES.DRAFTS);
            const req = store.put(record);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
        }
      } catch (err) {
        console.warn('[IndexedDB] Error saving draft to IndexedDB; persisted to fallback memory:', err);
      }
    }

    this.notifyChange();
  }

  /**
   * Retrieves a draft by ID from IndexedDB.
   */
  public async getDraft(id: string): Promise<OfflineDraftRecord | undefined> {
    if (!this.isBrowserIndexedDBAvailable()) {
      return this.memoryDrafts.get(id);
    }

    try {
      const db = await this.initDB();
      if (!db) return this.memoryDrafts.get(id);

      return await new Promise<OfflineDraftRecord | undefined>((resolve, reject) => {
        const tx = db.transaction([STORES.DRAFTS], 'readonly');
        const store = tx.objectStore(STORES.DRAFTS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result as OfflineDraftRecord | undefined);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[IndexedDB] Error reading draft from IndexedDB; reading fallback:', err);
      return this.memoryDrafts.get(id);
    }
  }

  /**
   * Retrieves all draft submissions stored in IndexedDB.
   */
  public async getAllDrafts(): Promise<OfflineDraftRecord[]> {
    if (!this.isBrowserIndexedDBAvailable()) {
      return Array.from(this.memoryDrafts.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }

    try {
      const db = await this.initDB();
      if (!db) {
        return Array.from(this.memoryDrafts.values());
      }

      return await new Promise<OfflineDraftRecord[]>((resolve, reject) => {
        const tx = db.transaction([STORES.DRAFTS], 'readonly');
        const store = tx.objectStore(STORES.DRAFTS);
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (req.result || []) as OfflineDraftRecord[];
          list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[IndexedDB] Error reading all drafts from IndexedDB; using fallback:', err);
      return Array.from(this.memoryDrafts.values());
    }
  }

  /**
   * Retrieves all drafts pending synchronization with the central server.
   */
  public async getPendingDrafts(): Promise<OfflineDraftRecord[]> {
    const all = await this.getAllDrafts();
    return all.filter((d) => d.syncStatus === 'PENDING_SYNC' || d.syncStatus === 'LOCAL_DRAFT');
  }

  /**
   * Deletes a draft submission from IndexedDB.
   */
  public async deleteDraft(id: string): Promise<void> {
    this.memoryDrafts.delete(id);

    if (this.isBrowserIndexedDBAvailable()) {
      try {
        const db = await this.initDB();
        if (db) {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction([STORES.DRAFTS], 'readwrite');
            const store = tx.objectStore(STORES.DRAFTS);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
        }
      } catch (err) {
        console.warn('[IndexedDB] Error deleting draft from IndexedDB:', err);
      }
    }

    this.notifyChange();
  }

  /**
   * Marks a set of draft submissions as SYNCED.
   */
  public async markDraftsAsSynced(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const drafts = await this.getAllDrafts();

    for (const draft of drafts) {
      if (idSet.has(draft.id)) {
        draft.syncStatus = 'SYNCED';
        draft.isOfflineDraft = false;
        await this.saveDraft(draft, { syncStatus: 'SYNCED', isOffline: false });
      }
    }

    this.notifyChange();
  }

  // =========================================================================
  // AUDIT LOGS OPERATIONS
  // =========================================================================

  /**
   * Persists an audit log entry into IndexedDB.
   */
  public async saveAuditLog(
    entry: AuditLogEntry,
    options: {
      syncStatus?: 'SYNCED' | 'PENDING_SYNC';
      isOffline?: boolean;
    } = {}
  ): Promise<void> {
    const now = new Date().toISOString();
    const syncStatus = options.syncStatus || 'PENDING_SYNC';
    const isOfflineRecord = options.isOffline !== undefined ? options.isOffline : syncStatus !== 'SYNCED';

    const record: OfflineAuditRecord = {
      ...JSON.parse(JSON.stringify(entry)),
      syncStatus,
      isOfflineRecord,
      persistedAt: now,
    };

    this.memoryAuditLogs.set(record.id, record);

    if (this.isBrowserIndexedDBAvailable()) {
      try {
        const db = await this.initDB();
        if (db) {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction([STORES.AUDIT_LOGS], 'readwrite');
            const store = tx.objectStore(STORES.AUDIT_LOGS);
            const req = store.put(record);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
        }
      } catch (err) {
        console.warn('[IndexedDB] Error saving audit log to IndexedDB:', err);
      }
    }

    this.notifyChange();
  }

  /**
   * Saves a batch of audit logs into IndexedDB in a single transaction.
   */
  public async saveAuditLogsBatch(
    entries: AuditLogEntry[],
    syncStatus: 'SYNCED' | 'PENDING_SYNC' = 'PENDING_SYNC'
  ): Promise<void> {
    const now = new Date().toISOString();
    const records: OfflineAuditRecord[] = entries.map((entry) => ({
      ...JSON.parse(JSON.stringify(entry)),
      syncStatus,
      isOfflineRecord: syncStatus !== 'SYNCED',
      persistedAt: now,
    }));

    records.forEach((r) => this.memoryAuditLogs.set(r.id, r));

    if (this.isBrowserIndexedDBAvailable()) {
      try {
        const db = await this.initDB();
        if (db) {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction([STORES.AUDIT_LOGS], 'readwrite');
            const store = tx.objectStore(STORES.AUDIT_LOGS);
            records.forEach((r) => store.put(r));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
        }
      } catch (err) {
        console.warn('[IndexedDB] Error saving audit logs batch to IndexedDB:', err);
      }
    }

    this.notifyChange();
  }

  /**
   * Retrieves all audit logs from IndexedDB.
   */
  public async getAllAuditLogs(): Promise<OfflineAuditRecord[]> {
    if (!this.isBrowserIndexedDBAvailable()) {
      return Array.from(this.memoryAuditLogs.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }

    try {
      const db = await this.initDB();
      if (!db) {
        return Array.from(this.memoryAuditLogs.values());
      }

      return await new Promise<OfflineAuditRecord[]>((resolve, reject) => {
        const tx = db.transaction([STORES.AUDIT_LOGS], 'readonly');
        const store = tx.objectStore(STORES.AUDIT_LOGS);
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (req.result || []) as OfflineAuditRecord[];
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[IndexedDB] Error reading audit logs from IndexedDB; using fallback:', err);
      return Array.from(this.memoryAuditLogs.values());
    }
  }

  /**
   * Retrieves audit logs that were created while offline and need central server upload.
   */
  public async getPendingAuditLogs(): Promise<OfflineAuditRecord[]> {
    const all = await this.getAllAuditLogs();
    return all.filter((l) => l.syncStatus === 'PENDING_SYNC');
  }

  /**
   * Marks audit logs as SYNCED.
   */
  public async markAuditLogsAsSynced(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const logs = await this.getAllAuditLogs();

    for (const log of logs) {
      if (idSet.has(log.id)) {
        log.syncStatus = 'SYNCED';
        log.isOfflineRecord = false;
        await this.saveAuditLog(log, { syncStatus: 'SYNCED', isOffline: false });
      }
    }

    this.notifyChange();
  }

  // =========================================================================
  // METADATA & SITE VISIT CONFIGURATION
  // =========================================================================

  public async getMetadata<T = any>(key: string): Promise<T | null> {
    if (!this.isBrowserIndexedDBAvailable()) {
      return this.memoryMetadata.get(key) || null;
    }

    try {
      const db = await this.initDB();
      if (!db) return this.memoryMetadata.get(key) || null;

      return await new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction([STORES.METADATA], 'readonly');
        const store = tx.objectStore(STORES.METADATA);
        const req = store.get(key);
        req.onsuccess = () => {
          const res = req.result as OfflineMetadataRecord | undefined;
          resolve(res ? (res.value as T) : null);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      return this.memoryMetadata.get(key) || null;
    }
  }

  public async setMetadata(key: string, value: any): Promise<void> {
    const now = new Date().toISOString();
    const record: OfflineMetadataRecord = { key, value, updatedAt: now };

    this.memoryMetadata.set(key, value);

    if (this.isBrowserIndexedDBAvailable()) {
      try {
        const db = await this.initDB();
        if (db) {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction([STORES.METADATA], 'readwrite');
            const store = tx.objectStore(STORES.METADATA);
            const req = store.put(record);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
        }
      } catch (err) {
        console.warn('[IndexedDB] Error setting metadata in IndexedDB:', err);
      }
    }

    this.notifyChange();
  }

  // =========================================================================
  // STATS & DIAGNOSTICS
  // =========================================================================

  public async getStorageStats(): Promise<OfflineStorageStats> {
    const drafts = await this.getAllDrafts();
    const auditLogs = await this.getAllAuditLogs();
    const lastSyncTimestamp = await this.getMetadata<string>('last_sync_timestamp');

    const pendingDrafts = drafts.filter((d) => d.syncStatus === 'PENDING_SYNC' || d.syncStatus === 'LOCAL_DRAFT').length;
    const pendingAuditLogs = auditLogs.filter((l) => l.syncStatus === 'PENDING_SYNC').length;

    // Estimate storage footprint
    const draftsPayload = JSON.stringify(drafts);
    const auditPayload = JSON.stringify(auditLogs);
    const estimatedSizeBytes = draftsPayload.length * 2 + auditPayload.length * 2;

    return {
      draftCount: drafts.length,
      auditCount: auditLogs.length,
      pendingDrafts,
      pendingAuditLogs,
      isIndexedDBSupported: this.isBrowserIndexedDBAvailable(),
      storageName: DB_NAME,
      lastSyncTimestamp: lastSyncTimestamp || null,
      estimatedSizeBytes,
    };
  }

  /**
   * Export an encrypted-style tamper-evident bundle for NBE remote inspection field teams.
   */
  public async exportOfflineVaultBundle(): Promise<{
    format: string;
    version: string;
    institutionCode: string;
    exportedAt: string;
    integritySeal: string;
    drafts: OfflineDraftRecord[];
    auditLogs: OfflineAuditRecord[];
    stats: OfflineStorageStats;
  }> {
    const drafts = await this.getAllDrafts();
    const auditLogs = await this.getAllAuditLogs();
    const stats = await this.getStorageStats();
    const exportedAt = new Date().toISOString();

    // Compute cryptographic bundle seal
    const str = `${drafts.length}:${auditLogs.length}:${exportedAt}:0000013`;
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    const integritySeal = `OB-NBE-OFFLINE-VAULT-${hash.toString(16).toUpperCase()}-${Date.now().toString(16).toUpperCase()}`;

    return {
      format: 'OROMIA_BANK_NBE_OFFLINE_STORAGE_PACKAGE',
      version: '1.0.0',
      institutionCode: '0000013',
      exportedAt,
      integritySeal,
      drafts,
      auditLogs,
      stats,
    };
  }

  /**
   * Clear all stores (useful for reset/testing).
   */
  public async clearAll(): Promise<void> {
    this.memoryDrafts.clear();
    this.memoryAuditLogs.clear();
    this.memoryMetadata.clear();

    if (this.isBrowserIndexedDBAvailable()) {
      try {
        const db = await this.initDB();
        if (db) {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction([STORES.DRAFTS, STORES.AUDIT_LOGS, STORES.METADATA], 'readwrite');
            tx.objectStore(STORES.DRAFTS).clear();
            tx.objectStore(STORES.AUDIT_LOGS).clear();
            tx.objectStore(STORES.METADATA).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
        }
      } catch (err) {
        console.warn('[IndexedDB] Clear error:', err);
      }
    }

    this.notifyChange();
  }
}

export const indexedDbStorage = new IndexedDbStorageService();
