import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Play, Loader2 } from 'lucide-react';

export interface CodeItem {
  id: string;
  code: string;
  title: string;
}

interface AutoSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  codes: CodeItem[];
  onCodeProcessed: (id: string, result: string) => void;
}

type Step = 'input' | 'validating' | 'confirming' | 'progress' | 'done';

interface LogEntry {
  id: string;
  code: string;
  title: string;
  result: string;
  message: string;
  points: number;
}

export function AutoSubmitModal({ isOpen, onClose, codes, onCodeProcessed }: AutoSubmitModalProps) {
  const [step, setStep] = useState<Step>('input');
  const [cookieName, setCookieName] = useState('SSESS');
  const [cookieValue, setCookieValue] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [playerId, setPlayerId] = useState<string | null>(null);
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pointsGained, setPointsGained] = useState(0);
  const [successful, setSuccessful] = useState(0);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [newCodesAdded, setNewCodesAdded] = useState(0);
  const [isCancelled, setIsCancelled] = useState(false);
  const [initialCodes, setInitialCodes] = useState<CodeItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (isOpen) {
      const storedName = localStorage.getItem('autoSubmitCookieName');
      const storedValue = localStorage.getItem('autoSubmitCookieValue');
      let initialShouldAutoValidate = false;
      if (storedName && storedValue) {
        setCookieName(storedName);
        setCookieValue(storedValue);
        initialShouldAutoValidate = true;
      }

      const isProd = process.env.NODE_ENV === 'production';
      const wsUrl = isProd 
        ? process.env.NEXT_PUBLIC_PROD_SYNC_WS_URL 
        : (process.env.NEXT_PUBLIC_DEV_SYNC_WS_URL || 'ws://localhost:3001');

      if (!wsUrl) return;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (initialShouldAutoValidate && storedName && storedValue) {
          setStep('validating');
          ws.send(JSON.stringify({
            type: 'auto_submit_validate',
            cookieName: storedName,
            cookieValue: storedValue
          }));
        }
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          
          if (data.type === 'auto_submit_validate_result') {
            if (data.success) {
              localStorage.setItem('autoSubmitCookieName', cookieName);
              localStorage.setItem('autoSubmitCookieValue', cookieValue);
              setPlayerId(data.playerId);
              setStep('confirming');
              setErrorMsg('');
            } else {
              localStorage.removeItem('autoSubmitCookieName');
              localStorage.removeItem('autoSubmitCookieValue');
              setErrorMsg(data.error || 'Validation failed.');
              setStep('input');
            }
          } else if (data.type === 'auto_submit_progress') {
            const { id, code, result, message, points } = data;
            
            // Call parent callback to update local state immediately
            onCodeProcessed(id, result);

            setLogs(prev => [...prev, {
              id,
              code,
              title: codes.find(c => c.id === id)?.title || code,
              result,
              message,
              points: points || 0
            }]);

            if (points) setPointsGained(prev => prev + points);
            if (result === 'success') setNewCodesAdded(prev => prev + 1);
            if (result === 'success' || result === 'already_redeemed') setSuccessful(prev => prev + 1);
            setTotalProcessed(prev => prev + 1);

          } else if (data.type === 'auto_submit_complete') {
            setStep('done');
          }
        } catch (e) {
          console.error('WS parsing error', e);
        }
      };

      ws.onerror = (e) => {
        console.error('WS Error', e);
        if (step === 'validating') {
          setErrorMsg('Failed to connect to sync server.');
          setStep('input');
        }
      };

    } else {
      // Clean up on close
      if (wsRef.current) {
        if (step === 'progress') {
          wsRef.current.send(JSON.stringify({ type: 'stop_auto_submit' }));
        }
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // Reset state
      setStep('input');
      setErrorMsg('');
      setLogs([]);
      setPointsGained(0);
      setSuccessful(0);
      setTotalProcessed(0);
      setTotalToProcess(0);
      setNewCodesAdded(0);
      setIsCancelled(false);
      setPlayerId(null);
      setInitialCodes([]);
    }

    return () => {
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN && step === 'progress') {
            wsRef.current.send(JSON.stringify({ type: 'stop_auto_submit' }));
        }
        wsRef.current.close();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookieName || !cookieValue) return;
    setStep('validating');
    setErrorMsg('');
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'auto_submit_validate',
        cookieName: cookieName.trim(),
        cookieValue: cookieValue.trim()
      }));
    } else {
      setErrorMsg('WebSocket is not connected yet. Try again.');
      setStep('input');
    }
  };

  const handleStart = () => {
    if (!playerId || codes.length === 0) return;
    setStep('progress');
    setIsCancelled(false);
    setLogs([]);
    setPointsGained(0);
    setSuccessful(0);
    setTotalProcessed(0);
    setTotalToProcess(codes.length);
    setNewCodesAdded(0);
    setInitialCodes([...codes]);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'auto_submit_start',
        cookieName: cookieName.trim(),
        cookieValue: cookieValue.trim(),
        playerId,
        codes: codes.map(c => ({ id: c.id, code: c.code }))
      }));
    }
  };

  const handleCancel = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_auto_submit' }));
    }
    setIsCancelled(true);
    setStep('done');
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50 shrink-0">
          <h3 className="font-extrabold text-xl text-gray-800 flex items-center gap-2">
            Auto Submit Codes
          </h3>
          <button
            onClick={step === 'progress' ? handleCancel : onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 'input' && (
            <form onSubmit={handleValidate} className="flex flex-col gap-4">
              <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm font-medium border border-blue-100">
                If you understand the implication of submitting your log in cookie, then you can use this feature. This will submit all currently filtered, not-entered codes.
              </div>
              
              {errorMsg && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-200 flex items-center gap-2">
                  <AlertCircle size={16} /> {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cookie Name</label>
                <input
                  type="text"
                  value={cookieName}
                  onChange={e => setCookieName(e.target.value)}
                  placeholder="e.g. SSESS12345..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cookie Value</label>
                <input
                  type="text"
                  value={cookieValue}
                  onChange={e => setCookieValue(e.target.value)}
                  placeholder="Paste cookie value here..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm"
              >
                Validate Log In
              </button>
            </form>
          )}

          {step === 'validating' && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="font-bold text-gray-600">Validating log in cookie...</p>
            </div>
          )}

          {step === 'confirming' && (
            <div className="flex flex-col items-center text-center gap-6 py-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <CheckCircle size={32} />
              </div>
              <div>
                <h4 className="text-xl font-extrabold text-gray-800 mb-2">Log in Validated!</h4>
                {codes.length > 0 ? (
                  <p className="text-gray-600 font-medium">
                    Will attempt to submit <strong className="text-blue-600 text-lg">{codes.length}</strong> codes.
                  </p>
                ) : (
                  <p className="text-red-600 font-medium">
                    You have 0 valid, unentered codes to submit.
                  </p>
                )}
              </div>
              <div className="w-full flex gap-3 mt-4">
                <button
                  onClick={() => {
                    localStorage.removeItem('autoSubmitCookieName');
                    localStorage.removeItem('autoSubmitCookieValue');
                    setCookieName('SSESS');
                    setCookieValue('');
                    setStep('input');
                  }}
                  type="button"
                  className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl transition-colors border border-red-200"
                >
                  Log Out
                </button>
                <button
                  onClick={onClose}
                  type="button"
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStart}
                  disabled={codes.length === 0}
                  type="button"
                  className={`flex-[2] py-3 ${codes.length === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2`}
                >
                  <Play size={18} /> Proceed?
                </button>
              </div>
            </div>
          )}

          {(step === 'progress' || step === 'done') && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-end mb-1">
                  <div>
                    <h4 className="font-bold text-gray-800 text-lg">
                      {step === 'done' ? (isCancelled ? 'Cancelled' : 'Complete!') : 'Submitting...'}
                    </h4>
                    <p className="text-sm font-medium text-gray-500">
                      Processed {totalProcessed} of {totalToProcess} codes
                    </p>
                  </div>
                  <div className="text-right flex gap-4">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase">New Codes</p>
                      <p className="text-2xl font-extrabold text-blue-600">{newCodesAdded}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase">Points Gained</p>
                      <p className="text-2xl font-extrabold text-green-600">+{pointsGained}</p>
                    </div>
                  </div>
                </div>

                {/* Progress bar container */}
                <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex">
                  {initialCodes.length > 0 && initialCodes.map((c, i) => {
                    const log = logs.find(l => l.id === c.id);
                    let color = 'bg-gray-200';
                    if (log) {
                      if (log.result === 'success') color = 'bg-green-500';
                      else if (log.result === 'already_redeemed') color = 'bg-yellow-400';
                      else if (log.result === 'not_found') color = 'bg-red-500';
                      else color = 'bg-red-500';
                    }
                    return (
                      <div key={c.id} className={`h-full flex-1 ${color} border-r border-white/20 last:border-0 transition-colors`} />
                    );
                  })}
                </div>
              </div>

              {/* Logs */}
              <div className="flex flex-col gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100 max-h-60 overflow-y-auto">
                {logs.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-4 font-medium">Waiting for first response...</p>
                )}
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <div className="mt-0.5">
                      {log.result === 'success' && <CheckCircle size={16} className="text-green-500" />}
                      {log.result === 'already_redeemed' && <AlertTriangle size={16} className="text-yellow-500" />}
                      {log.result === 'not_found' && <AlertCircle size={16} className="text-red-500" />}
                      {log.result === 'error' && <AlertCircle size={16} className="text-red-500" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between gap-2">
                        <span className="font-bold text-sm text-gray-800">{log.title}</span>
                        {log.points > 0 && <span className="font-extrabold text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">+{log.points}</span>}
                      </div>
                      <p className="text-xs font-mono text-gray-500 mt-1">{log.code}</p>
                      <p className="text-xs text-gray-600 mt-1.5 bg-gray-50 p-2 rounded">{log.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              {step === 'progress' ? (
                <button
                  onClick={handleCancel}
                  type="button"
                  className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl transition-colors border border-red-200"
                >
                  Stop Processing
                </button>
              ) : (
                <button
                  onClick={onClose}
                  type="button"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm"
                >
                  Close
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
