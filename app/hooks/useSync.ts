import { useEffect, useState, useCallback, useRef } from 'react';
import { useProgress } from './useProgress';

export function useSync() {
  const { setItemStatus, setItemMetadata } = useProgress();
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [syncEntered, setSyncEntered] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  
  // Reconnect logic
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load saved preferences
    const savedCode = localStorage.getItem('aadl_share_code');
    if (savedCode) setShareCode(savedCode);
    const savedNickname = localStorage.getItem('aadl_nickname');
    if (savedNickname) setNickname(savedNickname);
    const savedSyncEntered = localStorage.getItem('aadl_sync_entered');
    if (savedSyncEntered !== null) setSyncEntered(savedSyncEntered === 'true');
  }, []);

  const connect = useCallback(() => {
    if (!shareCode) return;

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
      ws.send(JSON.stringify({ type: 'join', shareCode, nickname }));
      
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
          setActiveUsers(data.users || []);
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Attempt reconnect after 5s
      reconnectTimeoutRef.current = setTimeout(() => {
        if (shareCode) connect();
      }, 5000);
    };
    
    ws.onerror = (err) => {
      console.error('WS Error:', err);
    };

  }, [shareCode, nickname, syncEntered, setItemStatus, setItemMetadata]);

  const applyRemoteEvent = useCallback((event: any) => {
    const { type, item_id, status, metadata, updated_at } = event;
    
    if (type === 'status') {
      if (status === 'entered' && !syncEntered) {
        return; // User opted out of syncing 'entered' state
      }
      setItemStatus(item_id, status, updated_at);
    } else if (type === 'metadata') {
      setItemMetadata(item_id, metadata, updated_at);
    }
  }, [syncEntered, setItemStatus, setItemMetadata]);

  useEffect(() => {
    if (shareCode) {
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
  }, [connect, shareCode]);

  // Listen to local updates and broadcast them
  useEffect(() => {
    const handleLocalUpdate = () => {
      if (!shareCode) return;
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
  }, [shareCode]);

  const joinShare = (code: string, nick?: string) => {
    const upperCode = code.toUpperCase();
    setShareCode(upperCode);
    localStorage.setItem('aadl_share_code', upperCode);
    if (nick) {
      setNickname(nick);
      localStorage.setItem('aadl_nickname', nick);
    }
  };

  const leaveShare = () => {
    setShareCode(null);
    localStorage.removeItem('aadl_share_code');
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const toggleSyncEntered = (val: boolean) => {
    setSyncEntered(val);
    localStorage.setItem('aadl_sync_entered', val.toString());
  };

  return {
    shareCode,
    nickname,
    activeUsers,
    isConnected,
    syncEntered,
    joinShare,
    leaveShare,
    toggleSyncEntered
  };
}
