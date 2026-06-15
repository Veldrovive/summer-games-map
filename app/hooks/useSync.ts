import { useEffect, useState, useCallback, useRef } from 'react';
import { useProgress } from './useProgress';

export function useSync() {
  const { setItemStatus, setItemMetadata } = useProgress();
  const [shareKey, setShareKey] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [syncEntered, setSyncEntered] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  
  // Reconnect logic
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load saved preferences
    const savedKey = localStorage.getItem('aadl_share_key');
    if (savedKey) setShareKey(savedKey);
    const savedNickname = localStorage.getItem('aadl_nickname');
    if (savedNickname) setNickname(savedNickname);
    const savedSyncEntered = localStorage.getItem('aadl_sync_entered');
    if (savedSyncEntered !== null) setSyncEntered(savedSyncEntered === 'true');
  }, []);

  const connect = useCallback(() => {
    if (!shareKey) return;

    const isProd = process.env.NODE_ENV === 'production';
    const wsUrl = isProd 
      ? process.env.NEXT_PUBLIC_PROD_SYNC_WS_URL 
      : (process.env.NEXT_PUBLIC_DEV_SYNC_WS_URL || 'ws://localhost:3001');

    if (!wsUrl) {
      console.error('WebSocket URL is not configured.');
      return;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'join', shareKey, nickname }));
      
      // Flush offline queue
      const queue = JSON.parse(localStorage.getItem('aadl_offline_queue') || '[]');
      if (queue.length > 0) {
        queue.forEach((event: any) => {
          ws.send(JSON.stringify({ type: 'update', event }));
        });
        localStorage.setItem('aadl_offline_queue', '[]');
      }
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === 'sync') {
          // Bulk sync
          data.events.forEach((event: any) => {
            applyRemoteEvent(event);
          });
        } else if (data.type === 'update') {
          // Single update
          applyRemoteEvent(data.event);
        } else if (data.type === 'users') {
          // Update active users
          setActiveUsers(Array.from(new Set(data.users || [])));
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Attempt reconnect after 5s
      reconnectTimeoutRef.current = setTimeout(() => {
        if (shareKey) connect();
      }, 5000);
    };
    
    ws.onerror = (err) => {
      console.error('WS Error:', err);
    };

  }, [shareKey, nickname, syncEntered, setItemStatus, setItemMetadata]);

  const applyRemoteEvent = useCallback((event: any) => {
    const item_id = event.item_id || event.id;
    const { type, status, metadata, updated_at } = event;
    
    if (!item_id) return; // Safely ignore events without a valid id

    if (type === 'status') {
      if (status === 'entered') {
        // Backwards compatibility for older clients sending 'entered' status
        setItemStatus(item_id, 'found', updated_at);
        if (syncEntered) {
          setItemMetadata(item_id, { entered: true }, updated_at);
        }
      } else {
        setItemStatus(item_id, status, updated_at);
      }
    } else if (type === 'metadata') {
      const finalMetadata = { ...metadata };
      if (!syncEntered && 'entered' in finalMetadata) {
        delete finalMetadata.entered;
      }
      if (Object.keys(finalMetadata).length > 0) {
        setItemMetadata(item_id, finalMetadata, updated_at);
      }
    }
  }, [syncEntered, setItemStatus, setItemMetadata]);

  useEffect(() => {
    if (shareKey) {
      connect();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect, shareKey]);

  // Listen to local updates and broadcast them
  useEffect(() => {
    const handleLocalUpdate = () => {
      if (!shareKey) return;
      const queue = JSON.parse(localStorage.getItem('aadl_offline_queue') || '[]');
      if (queue.length === 0) return;
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        queue.forEach((event: any) => {
          wsRef.current?.send(JSON.stringify({ type: 'update', event }));
        });
        localStorage.setItem('aadl_offline_queue', '[]');
      }
    };

    window.addEventListener('aadl_local_update', handleLocalUpdate);
    return () => {
      window.removeEventListener('aadl_local_update', handleLocalUpdate);
    };
  }, [shareKey]);

  const joinShare = (key: string, nick?: string) => {
    const upperKey = key.toUpperCase();
    setShareKey(upperKey);
    localStorage.setItem('aadl_share_key', upperKey);
    if (nick) {
      setNickname(nick);
      localStorage.setItem('aadl_nickname', nick);
    }
  };

  const updateNickname = (nick: string) => {
    setNickname(nick);
    localStorage.setItem('aadl_nickname', nick);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'update_nickname', nickname: nick }));
    }
  };

  const leaveShare = () => {
    setShareKey(null);
    localStorage.removeItem('aadl_share_key');
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const toggleSyncEntered = (val: boolean) => {
    setSyncEntered(val);
    localStorage.setItem('aadl_sync_entered', val.toString());
  };

  return {
    shareKey,
    nickname,
    activeUsers,
    isConnected,
    syncEntered,
    joinShare,
    leaveShare,
    toggleSyncEntered,
    updateNickname
  };
}
