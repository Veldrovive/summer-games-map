"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMapData } from "../hooks/useMapData";
import { useProgress } from "../hooks/useProgress";
import { ArrowLeft, Copy, CheckCircle2 } from "lucide-react";

export default function EnterCodes() {
  const { data, loading } = useMapData();
  const { itemStatuses, itemMetadata, setItemMetadata } = useProgress();

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const itemsToEnter = useMemo(() => {
    if (!data) return [];
    
    const items: any[] = [];
    
    data.bizcodes.forEach(b => {
      const status = itemStatuses[b.code_id];
      if (status === 'found' && !itemMetadata[b.code_id]?.entered) items.push({ id: b.code_id, title: b.bizcode, type: 'Business' });
    });
    data.homecodes.forEach(h => {
      const id = h.code_id || `home-${h.lat}-${h.lon}`;
      const status = itemStatuses[id];
      if (status === 'found' && !itemMetadata[id]?.entered) items.push({ id, title: h.homecode || 'Home Code', type: 'Home' });
    });
    data.badges.forEach(b => {
      const id = `badge-${b.lat}-${b.lon}`;
      const status = itemStatuses[id];
      if (status === 'found' && !itemMetadata[id]?.entered) items.push({ id, title: 'Badge', type: 'Badge' });
    });
    
    return items;
  }, [data, itemStatuses, itemMetadata]);

  const handleCopy = async (id: string, codeToCopy: string) => {
    if (!codeToCopy) return;
    try {
      await navigator.clipboard.writeText(codeToCopy);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error("Failed to copy", e);
    }
  };

  if (loading) return <div className="h-[100dvh] w-screen flex items-center justify-center bg-gray-50 font-medium text-xl text-gray-700">Loading Map Data...</div>;

  return (
    <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Enter Codes</h1>
        </div>
        <div className="text-sm font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {itemsToEnter.length} pending
        </div>
      </header>

      {/* Top Section: Swipeable Cards */}
      <div className="bg-gradient-to-b from-gray-100 to-gray-50 border-b border-gray-200 shrink-0 shadow-inner overflow-hidden">
        {itemsToEnter.length === 0 ? (
          <div className="py-10 px-6 text-center flex flex-col items-center justify-center min-h-[220px]">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-green-50">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <h2 className="text-gray-900 font-extrabold text-xl tracking-tight">All caught up!</h2>
            <p className="text-gray-500 text-sm mt-2 font-medium">You have no unentered codes.</p>
          </div>
        ) : (
          <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar p-5 gap-4 items-center min-h-[220px]">
            {itemsToEnter.map((item) => {
              const codeToCopy = itemMetadata[item.id]?.code || '';
              
              return (
                <div key={item.id} className="snap-center shrink-0 w-[280px] bg-white rounded-2xl p-5 shadow-lg border border-gray-200 flex flex-col gap-4 transform transition-transform hover:scale-[1.02]">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">{item.type}</span>
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: item.title }} className="text-sm font-bold text-gray-800 line-clamp-2 leading-snug" />
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center">
                    {codeToCopy ? (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-center text-lg text-gray-900 tracking-widest font-bold shadow-inner">
                        {codeToCopy}
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center text-sm text-gray-400 italic shadow-inner">
                        No code saved.
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-auto pt-2">
                    <button 
                      onClick={() => handleCopy(item.id, codeToCopy)}
                      disabled={!codeToCopy}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-gray-100 text-gray-800 font-bold py-2.5 rounded-xl text-sm transition-colors shadow-sm"
                    >
                      <Copy className="w-4 h-4" /> {copiedId === item.id ? 'Copied!' : 'Copy'}
                    </button>
                    <button 
                      onClick={() => setItemMetadata(item.id, { entered: true })}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm shadow-sm transition-colors ring-2 ring-blue-600 ring-offset-1"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Entered
                    </button>
                  </div>
                </div>
              );
            })}
            
            {/* Spacer to allow the last item to snap to center nicely */}
            <div className="shrink-0 w-8 h-1"></div>
          </div>
        )}
      </div>

      {/* Bottom Section: iframe */}
      <div className="flex-1 bg-white relative">
        <iframe 
          src="https://aadl.org/summergame/player/54029/gamecode"
          className="absolute inset-0 w-full h-full border-0"
          title="AADL Summer Game Player"
        />
      </div>

      {/* Scoped styles for hiding scrollbar but allowing scroll */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
