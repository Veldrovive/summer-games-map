"use client";

import { useState, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSync } from "../hooks/useSync";
import { Users, WifiOff, X, Copy, Check } from "lucide-react";

export function SyncProvider({ children }: { children: ReactNode }) {
  const { shareKey, nickname, activeUsers, isConnected, syncEntered, joinShare, leaveShare, toggleSyncEntered, updateNickname } = useSync();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [inputNick, setInputNick] = useState("");
  const [copied, setCopied] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const target = document.getElementById('sync-btn-portal');
    if (target) {
      setPortalTarget(target);
    } else {
      const observer = new MutationObserver(() => {
        const t = document.getElementById('sync-btn-portal');
        if (t) {
          setPortalTarget(t);
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }
  }, []);

  // Sync inputNick with nickname from localStorage once it's loaded
  useEffect(() => {
    if (nickname && !inputNick) setInputNick(nickname);
  }, [nickname]);

  const handleCreate = async () => {
    try {
      const nickToUse = inputNick || nickname || "Anonymous";
      // In a real app we'd call the API to generate, but we can also just generate client side and join
      const key = Math.random().toString(36).substring(2, 8).toUpperCase();
      joinShare(key, nickToUse);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = async () => {
    if (shareKey) {
      await navigator.clipboard.writeText(shareKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {shareKey && !isConnected && (
        <div className="bg-red-500 text-white text-xs font-bold px-4 py-2 flex items-center justify-center gap-2 relative z-[9999]">
          <WifiOff className="w-4 h-4" /> Sync Disconnected. Changes saved offline.
        </div>
      )}
      
      {/* Share Button (Portaled or Floating) */}
      {(() => {
        const btn = (
          <button 
            onClick={() => setIsModalOpen(true)}
            className={portalTarget 
              ? "bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-xl shadow-sm transition-transform hover:scale-105 flex items-center gap-2 border border-white/20 backdrop-blur-sm" 
              : "fixed bottom-4 left-4 md:left-[calc(420px+1rem)] z-[9990] bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center gap-2"}
            title="Group Sync"
          >
            <Users className={portalTarget ? "w-5 h-5 opacity-90" : "w-5 h-5"} />
            {shareKey ? <span className="font-bold pr-1 text-sm tracking-widest">{shareKey}</span> : null}
          </button>
        );
        return portalTarget ? createPortal(btn, portalTarget) : btn;
      })()}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
              <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" /> Share Keys
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="space-y-3">
                <h3 className="font-bold text-gray-800 text-sm">Your Nickname</h3>
                <input 
                  type="text" 
                  value={inputNick} 
                  onChange={(e) => setInputNick(e.target.value)}
                  onBlur={() => {
                    const nickToUse = inputNick || "Anonymous";
                    if (nickToUse !== nickname) {
                      updateNickname(nickToUse);
                    }
                  }}
                  placeholder={nickname || "Enter nickname"}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                  maxLength={20}
                />
              </div>

              {shareKey ? (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Current Share Key</p>
                    <div className="flex items-center justify-center gap-2">
                      <div className="text-4xl font-extrabold text-blue-700 tracking-widest bg-blue-50 py-3 px-6 rounded-xl border border-blue-100">
                        {shareKey}
                      </div>
                      <button onClick={handleCopy} className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors">
                        {copied ? <Check className="w-6 h-6 text-green-600" /> : <Copy className="w-6 h-6" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 font-medium">Status: {isConnected ? <span className="text-green-500">Connected</span> : <span className="text-red-500">Offline</span>}</p>
                  </div>
                  
                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={syncEntered} 
                      onChange={(e) => toggleSyncEntered(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-gray-800 text-sm">Sync "Entered" Status</div>
                      <div className="text-xs text-gray-500 font-medium leading-snug mt-0.5">If disabled, you won't receive other people's entered status, keeping your own tracker clean.</div>
                    </div>
                  </label>

                  {activeUsers.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-600" /> Active Users
                      </h3>
                      <ul className="space-y-2">
                        {activeUsers.map((u, i) => (
                          <li key={i} className="text-sm font-medium text-gray-700 flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span> 
                            {u} {u === nickname ? <span className="text-xs text-gray-400 font-bold ml-1">(You)</span> : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button 
                    onClick={leaveShare}
                    className="w-full py-3 font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors text-sm"
                  >
                    Leave Share Group
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h3 className="font-bold text-gray-800 text-sm">Join an existing group</h3>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={inputKey} 
                        onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                        placeholder="e.g. ABCDEF"
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-mono font-bold text-lg"
                        maxLength={6}
                      />
                      <button 
                        onClick={() => {
                          const nickToUse = inputNick || nickname || "Anonymous";
                          if (inputKey.length > 0) joinShare(inputKey, nickToUse);
                        }}
                        disabled={inputKey.length === 0}
                        className="px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
                      >
                        Join
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-gray-200"></div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">OR</span>
                    <div className="flex-1 h-px bg-gray-200"></div>
                  </div>
                  
                  <button 
                    onClick={handleCreate}
                    className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl shadow-md transition-colors"
                  >
                    Create New Share Key
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
