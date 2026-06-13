"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useMapData } from "./hooks/useMapData";
import { useProgress } from "./hooks/useProgress";
import { calculateDistance } from "./lib/distance";
import { geocodeAddress } from "./lib/geocoding";
import { Search, MapPin, SlidersHorizontal, CheckCircle2, Circle, Navigation, List } from "lucide-react";

// Dynamically import map to avoid SSR issues
const Map = dynamic(() => import("./components/Map"), { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center bg-gray-100 font-medium text-gray-500">Loading Map...</div> });

export default function Home() {
  const { data, loading, error } = useMapData();
  const { checkedItems, toggleItem } = useProgress();

  const [address, setAddress] = useState("");
  const [center, setCenter] = useState({ lat: 42.2808, lon: -83.7430 }); // Ann Arbor default
  const [radius, setRadius] = useState<number>(5); // Default 5 miles
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Filters
  const [showBiz, setShowBiz] = useState(true);
  const [showHome, setShowHome] = useState(true);
  const [showBadges, setShowBadges] = useState(true);
  const [hideChecked, setHideChecked] = useState(false);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setIsGeocoding(true);
    const result = await geocodeAddress(address);
    if (result) {
      setCenter(result);
    } else {
      alert("Address not found. Please try a different query.");
    }
    setIsGeocoding(false);
  };

  const handleUseLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenter({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          console.error(error);
          alert("Unable to retrieve your location. Please ensure location permissions are granted.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const filteredData = useMemo(() => {
    if (!data) return { bizcodes: [], homecodes: [], badges: [] };

    const filterByDistanceAndChecked = (items: any[], latKey: string = 'lat', lonKey: string = 'lon', idKeyFunc: (item: any) => string) => {
      return items.filter(item => {
        const id = idKeyFunc(item);
        if (hideChecked && checkedItems.has(id)) return false;
        if (!item[latKey] || !item[lonKey]) return false; // Safety check
        const dist = calculateDistance(center.lat, center.lon, parseFloat(item[latKey]), parseFloat(item[lonKey]));
        return dist <= radius;
      });
    };

    return {
      bizcodes: showBiz ? filterByDistanceAndChecked(data.bizcodes, 'lat', 'lon', b => b.code_id) : [],
      homecodes: showHome ? filterByDistanceAndChecked(data.homecodes, 'lat', 'lon', h => h.code_id || `home-${h.lat}-${h.lon}`) : [],
      badges: showBadges ? filterByDistanceAndChecked(data.badges, 'lat', 'lon', b => `badge-${b.lat}-${b.lon}`) : []
    };
  }, [data, center, radius, showBiz, showHome, showBadges, hideChecked, checkedItems]);

  const totalVisible = filteredData.bizcodes.length + filteredData.homecodes.length + filteredData.badges.length;

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-gray-50 text-xl font-medium text-gray-700">Loading Map Data...</div>;
  if (error) return <div className="h-screen w-screen flex items-center justify-center bg-red-50 text-red-600 font-medium">Error loading data: {error.message}</div>;

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-gray-50 font-sans text-gray-900">
      
      {/* Sidebar */}
      <aside className="w-full md:w-[420px] bg-white border-r border-gray-200 flex flex-col shadow-2xl z-10">
        <div className="p-6 bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-md">
          <h1 className="text-2xl font-extrabold tracking-tight">AADL Summer Game</h1>
          <p className="text-blue-100 text-sm mt-1 font-medium opacity-90">Map Explorer & Tracker</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
          
          {/* Location Settings */}
          <section className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Location
            </h2>
            
            <form onSubmit={handleSearch} className="flex gap-2 mb-3">
              <input 
                type="text" 
                placeholder="Enter address or zip..." 
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium"
              />
              <button 
                type="submit" 
                disabled={isGeocoding}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                <Search className="w-5 h-5" />
              </button>
            </form>

            <button 
              onClick={handleUseLocation}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium text-sm"
            >
              <Navigation className="w-4 h-4 text-blue-600" /> Use My Location
            </button>
          </section>

          {/* Distance Filter */}
          <section className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" /> Max Distance
              </h2>
              <span className="font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full text-sm border border-blue-100">{radius} miles</span>
            </div>
            
            <input 
              type="range" 
              min="0.5" 
              max="50" 
              step="0.5"
              value={radius}
              onChange={e => setRadius(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-3 font-semibold">
              <span>0.5m</span>
              <span>25m</span>
              <span>50m</span>
            </div>
          </section>

          {/* Filters */}
          <section className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Map Filters
            </h2>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={showBiz} onChange={e => setShowBiz(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-colors" />
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-sm ring-2 ring-white"></div>
                  <span className="font-semibold text-gray-700 group-hover:text-gray-900 transition-colors text-sm">Business Codes</span>
                </div>
                <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{data?.bizcodes.length || 0}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={showHome} onChange={e => setShowHome(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 transition-colors" />
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-sm ring-2 ring-white"></div>
                  <span className="font-semibold text-gray-700 group-hover:text-gray-900 transition-colors text-sm">Home Codes</span>
                </div>
                <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{data?.homecodes.length || 0}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={showBadges} onChange={e => setShowBadges(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500 transition-colors" />
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-500 shadow-sm ring-2 ring-white"></div>
                  <span className="font-semibold text-gray-700 group-hover:text-gray-900 transition-colors text-sm">Badges</span>
                </div>
                <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{data?.badges.length || 0}</span>
              </label>

              <div className="h-px bg-gray-100 my-4"></div>

              <label className="flex items-center gap-3 cursor-pointer bg-gray-50 p-3 rounded-xl border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all shadow-sm">
                <input type="checkbox" checked={hideChecked} onChange={e => setHideChecked(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-gray-700 focus:ring-gray-600" />
                <span className="font-semibold text-gray-700 text-sm">Hide Checked Off Items</span>
              </label>
            </div>
          </section>

          {/* Progress Stats */}
          <section className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-xl border border-blue-100 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-800 mb-1">Total Progress</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-blue-700 tracking-tight">{checkedItems.size}</span>
              <span className="text-blue-600/80 font-semibold text-sm">items checked off</span>
            </div>
          </section>

        </div>

        {/* View Toggle (Mobile) */}
        <div className="p-4 border-t border-gray-200 bg-white md:hidden">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button 
              onClick={() => setViewMode('map')} 
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-2 ${viewMode === 'map' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500'}`}
            >
              <MapPin className="w-4 h-4" /> Map View
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-2 ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500'}`}
            >
              <List className="w-4 h-4" /> List View
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 relative ${viewMode === 'list' ? 'block md:block' : 'hidden md:block'} ${viewMode === 'map' ? 'block md:block' : 'hidden md:hidden'}`}>
        {viewMode === 'map' ? (
          <>
            <div className="absolute top-6 left-6 z-[1000] bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-full shadow-lg border border-gray-200 font-bold text-gray-800 text-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              Showing {totalVisible} locations in range
            </div>
            <Map 
              center={center} 
              bizcodes={filteredData.bizcodes} 
              homecodes={filteredData.homecodes} 
              badges={filteredData.badges}
              checkedItems={checkedItems}
              onToggleCheck={toggleItem}
            />
          </>
        ) : (
          <div className="h-full overflow-y-auto p-6 lg:p-10 bg-gray-50">
            <h2 className="text-2xl font-extrabold mb-6 text-gray-800 tracking-tight">Locations List ({totalVisible})</h2>
            <p className="text-gray-500 font-medium mb-8">Showing locations within {radius} miles of your center point.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredData.bizcodes.map(biz => {
                 const id = biz.code_id;
                 const isChecked = checkedItems.has(id);
                 return (
                   <div key={id} className={`p-5 rounded-2xl border transition-all ${isChecked ? 'bg-gray-100 border-gray-200 opacity-70 scale-[0.98]' : 'bg-white border-blue-100 shadow-md hover:shadow-lg'}`}>
                      <div className="flex gap-4 items-start flex-col h-full">
                        <div className="flex items-center gap-2 w-full">
                          <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0 ring-2 ring-blue-100"></div>
                          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Business</span>
                        </div>
                        <div className="flex-1 w-full">
                          <div dangerouslySetInnerHTML={{ __html: biz.bizcode }} className="text-sm mb-4 font-medium text-gray-800 leading-relaxed" />
                        </div>
                        <button onClick={() => toggleItem(id)} className={`w-full text-sm px-4 py-2.5 rounded-xl font-bold transition-colors ${isChecked ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                          {isChecked ? 'Uncheck Item' : 'Check Off'}
                        </button>
                      </div>
                   </div>
                 );
              })}
              {/* Similar logic for Home codes and badges could be added here for a comprehensive list view */}
            </div>
          </div>
        )}
      </main>

    </div>
  );
}
