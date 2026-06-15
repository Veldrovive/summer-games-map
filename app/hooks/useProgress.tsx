"use client";

import React, { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

export type ItemStatus = 'found' | 'not_found' | 'entered';

export type ProgressItem = {
  status: ItemStatus;
  updated_at: number;
};

export type ItemMetadata = { notes?: string; code?: string, updated_at?: number };

type ProgressContextType = {
  progressState: Record<string, ProgressItem>;
  itemStatuses: Record<string, ItemStatus>;
  setItemStatus: (id: string, status: ItemStatus | null, remoteTimestamp?: number) => void;
  toggleItem: (id: string) => void;
  checkedItems: Set<string>;
  itemMetadata: Record<string, ItemMetadata>;
  setItemMetadata: (id: string, metadata: Partial<ItemMetadata>, remoteTimestamp?: number) => void;
  restoreBackup: (data: { progress?: Record<string, ProgressItem>, metadata?: Record<string, ItemMetadata> }) => void;
};

const ProgressContext = createContext<ProgressContextType | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progressState, setProgressState] = useState<Record<string, ProgressItem>>({});
  const [itemMetadata, setItemMetadataState] = useState<Record<string, ItemMetadata>>({});

  useEffect(() => {
    try {
      const storedV3 = localStorage.getItem('aadl_progress_v3');
      if (storedV3) {
        const parsed = JSON.parse(storedV3);
        if (parsed["undefined"]) {
          delete parsed["undefined"];
          localStorage.setItem('aadl_progress_v3', JSON.stringify(parsed));
        }
        setProgressState(parsed);
      } else {
        // Migration from v2
        const storedV2 = localStorage.getItem('aadl_progress_v2');
        if (storedV2) {
          const parsedV2 = JSON.parse(storedV2) as Record<string, ItemStatus>;
          const migrated: Record<string, ProgressItem> = {};
          const now = Date.now();
          for (const [id, status] of Object.entries(parsedV2)) {
            migrated[id] = { status, updated_at: now };
          }
          setProgressState(migrated);
          localStorage.setItem('aadl_progress_v3', JSON.stringify(migrated));
        } else {
          // Migration from v1
          const oldStored = localStorage.getItem('aadl_progress');
          if (oldStored) {
            const parsed = JSON.parse(oldStored);
            if (Array.isArray(parsed)) {
              const migrated: Record<string, ProgressItem> = {};
              const now = Date.now();
              parsed.forEach((id: string) => { migrated[id] = { status: 'found', updated_at: now }; });
              setProgressState(migrated);
              localStorage.setItem('aadl_progress_v3', JSON.stringify(migrated));
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to load progress", e);
    }
    try {
      const meta = localStorage.getItem('aadl_metadata');
      if (meta) {
        const parsedMeta = JSON.parse(meta);
        if (parsedMeta["undefined"]) {
          delete parsedMeta["undefined"];
          localStorage.setItem('aadl_metadata', JSON.stringify(parsedMeta));
        }
        setItemMetadataState(parsedMeta);
      }
    } catch (e) {
      console.error("Failed to load metadata", e);
    }
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'aadl_progress_v3' && e.newValue) {
        setProgressState(JSON.parse(e.newValue));
      } else if (e.key === 'aadl_metadata' && e.newValue) {
        setItemMetadataState(JSON.parse(e.newValue));
      }
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setItemStatus = useCallback((id: string, status: ItemStatus | null, remoteTimestamp?: number) => {
    let sideEffectsRun = false;
    setProgressState(prev => {
      const next = { ...prev };
      const newTimestamp = remoteTimestamp ?? Date.now();
      
      // If we are applying a remote update, only apply if newer
      if (remoteTimestamp && prev[id] && prev[id].updated_at >= remoteTimestamp) {
        return prev;
      }

      if (status === null) {
        delete next[id];
      } else {
        next[id] = { status, updated_at: newTimestamp };
      }
      
      if (!sideEffectsRun) {
        sideEffectsRun = true;
        try {
          localStorage.setItem('aadl_progress_v3', JSON.stringify(next));
          
          // If it's a local change, add to offline queue
          if (!remoteTimestamp) {
            const queue = JSON.parse(localStorage.getItem('aadl_offline_queue') || '[]');
            queue.push({ type: 'status', id, status, updated_at: newTimestamp });
            localStorage.setItem('aadl_offline_queue', JSON.stringify(queue));
            
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('aadl_local_update'));
            }, 0);
          }
        } catch (e) {
           console.error("Failed to save progress", e);
        }
      }
      
      return next;
    });
  }, []);

  const toggleItem = useCallback((id: string) => {
    let sideEffectsRun = false;
    setProgressState(prev => {
      const next = { ...prev };
      const current = next[id]?.status;
      let newStatus: ItemStatus | null = null;
      const now = Date.now();
      
      if (current === 'found' || current === 'entered') {
        newStatus = null;
        delete next[id];
      } else {
        newStatus = 'found';
        next[id] = { status: 'found', updated_at: now };
      }
      
      if (!sideEffectsRun) {
        sideEffectsRun = true;
        try {
          localStorage.setItem('aadl_progress_v3', JSON.stringify(next));
          
          const queue = JSON.parse(localStorage.getItem('aadl_offline_queue') || '[]');
          queue.push({ type: 'status', id, status: newStatus, updated_at: now });
          localStorage.setItem('aadl_offline_queue', JSON.stringify(queue));
          
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('aadl_local_update'));
          }, 0);
        } catch (e) {
           console.error("Failed to save progress", e);
        }
      }
      
      return next;
    });
  }, []);

  const setItemMetadata = useCallback((id: string, metadata: Partial<ItemMetadata>, remoteTimestamp?: number) => {
    let sideEffectsRun = false;
    setItemMetadataState(prev => {
      const next = { ...prev };
      const newTimestamp = remoteTimestamp ?? Date.now();
      
      // If remote, only apply if newer
      if (remoteTimestamp && prev[id] && prev[id].updated_at && prev[id].updated_at! >= remoteTimestamp) {
        return prev;
      }
      
      next[id] = { ...(next[id] || {}), ...metadata, updated_at: newTimestamp };
      
      if (!sideEffectsRun) {
        sideEffectsRun = true;
        try {
          localStorage.setItem('aadl_metadata', JSON.stringify(next));
          
          if (!remoteTimestamp) {
            const queue = JSON.parse(localStorage.getItem('aadl_offline_queue') || '[]');
            queue.push({ type: 'metadata', id, metadata, updated_at: newTimestamp });
            localStorage.setItem('aadl_offline_queue', JSON.stringify(queue));
            
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('aadl_local_update'));
            }, 0);
          }
        } catch (e) {
           console.error("Failed to save metadata", e);
        }
      }
      
      return next;
    });
  }, []);

  const restoreBackup = useCallback((data: { progress?: Record<string, ProgressItem>, metadata?: Record<string, ItemMetadata> }) => {
    if (data.progress) {
      setProgressState(prev => {
        const next = { ...prev };
        let hasChanges = false;
        const queue = JSON.parse(localStorage.getItem('aadl_offline_queue') || '[]');

        for (const [id, item] of Object.entries(data.progress)) {
          const prevItem = prev[id];
          if (!prevItem || prevItem.updated_at < item.updated_at) {
            next[id] = item;
            hasChanges = true;
            queue.push({ type: 'status', id, status: item.status, updated_at: item.updated_at });
          }
        }

        if (hasChanges) {
          localStorage.setItem('aadl_progress_v3', JSON.stringify(next));
          localStorage.setItem('aadl_offline_queue', JSON.stringify(queue));
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('aadl_local_update'));
          }, 0);
        }

        return next;
      });
    }

    if (data.metadata) {
      setItemMetadataState(prev => {
        const next = { ...prev };
        let hasChanges = false;
        const queue = JSON.parse(localStorage.getItem('aadl_offline_queue') || '[]');

        for (const [id, item] of Object.entries(data.metadata)) {
          const prevItem = prev[id];
          const itemTimestamp = item.updated_at || Date.now();
          const prevTimestamp = prevItem?.updated_at || 0;
          
          if (itemTimestamp > prevTimestamp) {
            next[id] = { ...prevItem, ...item, updated_at: itemTimestamp };
            hasChanges = true;
            queue.push({ type: 'metadata', id, metadata: item, updated_at: itemTimestamp });
          }
        }

        if (hasChanges) {
          localStorage.setItem('aadl_metadata', JSON.stringify(next));
          localStorage.setItem('aadl_offline_queue', JSON.stringify(queue));
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('aadl_local_update'));
          }, 0);
        }

        return next;
      });
    }
  }, []);

  // Compute a backwards-compatible itemStatuses for UI components
  const itemStatuses: Record<string, ItemStatus> = {};
  for (const [key, val] of Object.entries(progressState)) {
    itemStatuses[key] = val.status;
  }

  const checkedItems = new Set(Object.keys(progressState).filter(k => progressState[k]?.status === 'found' || progressState[k]?.status === 'entered'));

  return (
    <ProgressContext.Provider value={{ progressState, itemStatuses, setItemStatus, toggleItem, checkedItems, itemMetadata, setItemMetadata, restoreBackup }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
}
