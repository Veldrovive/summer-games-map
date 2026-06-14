import { useState, useEffect, useCallback } from 'react';

export type ItemStatus = 'found' | 'not_found' | 'entered';

export type ItemMetadata = { notes?: string; code?: string };

export function useProgress() {
  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemStatus>>({});
  const [itemMetadata, setItemMetadataState] = useState<Record<string, ItemMetadata>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem('aadl_progress_v2');
      if (stored) {
        setItemStatuses(JSON.parse(stored));
      } else {
        // Migration from v1
        const oldStored = localStorage.getItem('aadl_progress');
        if (oldStored) {
          const parsed = JSON.parse(oldStored);
          if (Array.isArray(parsed)) {
            const migrated: Record<string, ItemStatus> = {};
            parsed.forEach(id => { migrated[id] = 'found'; });
            setItemStatuses(migrated);
            localStorage.setItem('aadl_progress_v2', JSON.stringify(migrated));
          }
        }
      }
    } catch (e) {
      console.error("Failed to load progress", e);
    }
    try {
      const meta = localStorage.getItem('aadl_metadata');
      if (meta) {
        setItemMetadataState(JSON.parse(meta));
      }
    } catch (e) {
      console.error("Failed to load metadata", e);
    }
  }, []);

  const setItemStatus = useCallback((id: string, status: ItemStatus | null) => {
    setItemStatuses(prev => {
      const next = { ...prev };
      if (status === null) {
        delete next[id];
      } else {
        next[id] = status;
      }
      try {
        localStorage.setItem('aadl_progress_v2', JSON.stringify(next));
      } catch (e) {
         console.error("Failed to save progress", e);
      }
      return next;
    });
  }, []);

  const toggleItem = useCallback((id: string) => {
    setItemStatuses(prev => {
      const next = { ...prev };
      if (next[id] === 'found' || next[id] === 'entered') {
        delete next[id];
      } else {
        next[id] = 'found';
      }
      try {
        localStorage.setItem('aadl_progress_v2', JSON.stringify(next));
      } catch (e) {
         console.error("Failed to save progress", e);
      }
      return next;
    });
  }, []);

  const setItemMetadata = useCallback((id: string, metadata: Partial<ItemMetadata>) => {
    setItemMetadataState(prev => {
      const next = { ...prev };
      next[id] = { ...(next[id] || {}), ...metadata };
      try {
        localStorage.setItem('aadl_metadata', JSON.stringify(next));
      } catch (e) {
         console.error("Failed to save metadata", e);
      }
      return next;
    });
  }, []);

  const checkedItems = new Set(Object.keys(itemStatuses).filter(k => itemStatuses[k] === 'found' || itemStatuses[k] === 'entered'));

  return { itemStatuses, setItemStatus, toggleItem, checkedItems, itemMetadata, setItemMetadata };
}
