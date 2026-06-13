import { useState, useEffect, useCallback } from 'react';

export function useProgress() {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem('aadl_progress');
      if (stored) {
        setCheckedItems(new Set(JSON.parse(stored)));
      }
    } catch (e) {
      console.error("Failed to load progress", e);
    }
  }, []);

  const toggleItem = useCallback((id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem('aadl_progress', JSON.stringify(Array.from(next)));
      } catch (e) {
         console.error("Failed to save progress", e);
      }
      return next;
    });
  }, []);

  return { checkedItems, toggleItem };
}
