import { useState, useEffect, useCallback } from 'react';

export type ItemStatus = 'found' | 'not_found';

export function useProgress() {
  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemStatus>>({});

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
      if (next[id] === 'found') {
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

  const checkedItems = new Set(Object.keys(itemStatuses).filter(k => itemStatuses[k] === 'found'));

  return { itemStatuses, setItemStatus, toggleItem, checkedItems };
}
