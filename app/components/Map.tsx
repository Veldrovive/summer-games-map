"use client";

import { useMemo, useState } from "react";
import MapGL, { Marker, Source, Layer } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ItemStatus } from "../hooks/useProgress";

type MapProps = {
  center: { lat: number; lon: number };
  bizcodes: BizCode[];
  homecodes: HomeCode[];
  badges: Badge[];
  itemStatuses: Record<string, ItemStatus>;
  onSetItemStatus: (id: string, status: ItemStatus | null) => void;
  
  // Routing props
  routeMode: boolean;
  routePoints: RoutePoint[];
  routeGeoJSON: any;
  onAddRoutePoint: (point: RoutePoint) => void;
};

// We use a free base map from Protomaps or standard OSM. 
// Standard OSM raster tiles via MapLibre style JSON:
const osmStyle = {
  version: 8 as const,
  sources: {
    'osm': {
      type: 'raster' as const,
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap Contributors',
    }
  },
  layers: [
    {
      id: 'osm',
      type: 'raster' as const,
      source: 'osm',
      minzoom: 0,
      maxzoom: 22
    }
  ]
};

const createDot = (color: string, status: ItemStatus | undefined, isRouteSelected: boolean, seqNum?: number) => {
  let bgColor = color;
  if (isRouteSelected) {
    bgColor = '#8b5cf6';
  } else if (status === 'found') {
    bgColor = '#9ca3af';
  } else if (status === 'not_found') {
    bgColor = '#ef4444';
  }

  return (
    <div style={{
      backgroundColor: bgColor,
      width: isRouteSelected ? '24px' : '16px',
      height: isRouteSelected ? '24px' : '16px',
      borderRadius: '50%',
      border: isRouteSelected ? '3px solid white' : '2px solid white',
      boxShadow: '0 0 4px rgba(0,0,0,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: '12px',
      fontWeight: 'bold',
      transition: 'all 0.2s'
    }}>
      {seqNum !== undefined ? seqNum : ''}
    </div>
  );
};

export default function Map({ 
  center, 
  bizcodes, 
  homecodes, 
  badges, 
  itemStatuses, 
  onSetItemStatus,
  routeMode,
  routePoints,
  routeGeoJSON,
  onAddRoutePoint
}: MapProps) {
  const [popupInfo, setPopupInfo] = useState<any>(null);

  const handleMarkerClick = (e: any, item: any, type: string) => {
    e.originalEvent.stopPropagation();
    
    if (routeMode) {
      const point: RoutePoint = {
        id: item.code_id || `${type}-${item.lat}-${item.lon}`,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        name: type === 'biz' ? item.bizcode : (type === 'home' ? item.homecode : 'Badge')
      };
      onAddRoutePoint(point);
    } else {
      setPopupInfo({ ...item, type });
    }
  };

  const getRouteSequenceNumber = (id: string) => {
    if (!routeMode) return undefined;
    const idx = routePoints.findIndex(p => p.id === id);
    return idx !== -1 ? idx + 1 : undefined;
  };

  return (
    <div className="relative w-full h-full">
      <MapGL
        initialViewState={{
        longitude: center.lon,
        latitude: center.lat,
        zoom: 13
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={osmStyle}
      mapLib={maplibregl}
    >
      {/* Route Layer */}
      {routeGeoJSON && routeMode && (
        <Source type="geojson" data={routeGeoJSON}>
          <Layer
            id="route"
            type="line"
            paint={{
              'line-color': '#3b82f6',
              'line-width': 5,
              'line-opacity': 0.7
            }}
          />
        </Source>
      )}

      {/* User Location Marker */}
      <Marker longitude={center.lon} latitude={center.lat} anchor="center">
        <div style={{
          backgroundColor: '#ef4444',
          width: '16px', height: '16px',
          borderRadius: '50%',
          border: '2px solid white',
          boxShadow: '0 0 4px rgba(0,0,0,0.4)'
        }} title="Your Location" />
      </Marker>

      {bizcodes.map((biz) => {
        const id = biz.code_id;
        const status = itemStatuses[id];
        const seq = getRouteSequenceNumber(id);
        return (
          <Marker 
            key={`biz-${id}`} 
            longitude={parseFloat(biz.lon)} 
            latitude={parseFloat(biz.lat)} 
            anchor="center"
            onClick={(e) => handleMarkerClick(e, biz, 'biz')}
            style={{ cursor: 'pointer', zIndex: seq ? 10 : 1 }}
          >
            {createDot('#3b82f6', status, seq !== undefined, seq)}
          </Marker>
        );
      })}

      {homecodes.map((home) => {
        const id = home.code_id || `home-${home.lat}-${home.lon}`;
        const status = itemStatuses[id];
        const seq = getRouteSequenceNumber(id);
        return (
          <Marker 
            key={id} 
            longitude={parseFloat(home.lon)} 
            latitude={parseFloat(home.lat)} 
            anchor="center"
            onClick={(e) => handleMarkerClick(e, home, 'home')}
            style={{ cursor: 'pointer', zIndex: seq ? 10 : 1 }}
          >
            {createDot('#10b981', status, seq !== undefined, seq)}
          </Marker>
        );
      })}

      {badges.map((badge) => {
        const id = `badge-${badge.lat}-${badge.lon}`;
        const status = itemStatuses[id];
        const seq = getRouteSequenceNumber(id);
        return (
          <Marker 
            key={id} 
            longitude={parseFloat(badge.lon)} 
            latitude={parseFloat(badge.lat)} 
            anchor="center"
            onClick={(e) => handleMarkerClick(e, badge, 'badge')}
            style={{ cursor: 'pointer', zIndex: seq ? 10 : 1 }}
          >
            {createDot('#f59e0b', status, seq !== undefined, seq)}
          </Marker>
        );
      })}

      </MapGL>

      {/* Modal Overlay */}
      {popupInfo && !routeMode && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col transform transition-all">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800">
                {popupInfo.type === 'biz' ? 'Business Code' : (popupInfo.type === 'home' ? 'Home Code' : 'Badge')}
              </h3>
              <button 
                onClick={() => setPopupInfo(null)}
                className="text-gray-500 hover:text-gray-800 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {popupInfo.type === 'badge' && popupInfo.image && (
                <img src={`https://aadl.org${popupInfo.image}`} alt="Badge" className="w-32 h-32 object-contain mb-6 mx-auto drop-shadow-md" />
              )}
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100">
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: popupInfo.type === 'biz' ? popupInfo.bizcode : (popupInfo.type === 'home' ? popupInfo.homecode : popupInfo.popup) 
                  }} 
                  className={`text-gray-800 text-lg ${popupInfo.type === 'badge' ? 'text-center font-medium' : ''} prose prose-sm max-w-none`} 
                />
              </div>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    const id = popupInfo.type === 'biz' ? popupInfo.code_id : (popupInfo.type === 'home' ? (popupInfo.code_id || `home-${popupInfo.lat}-${popupInfo.lon}`) : `badge-${popupInfo.lat}-${popupInfo.lon}`);
                    const currentStatus = itemStatuses[id];
                    onSetItemStatus(id, currentStatus === 'found' ? null : 'found');
                    setPopupInfo(null);
                  }}
                  className={`px-4 py-3 text-white rounded-lg text-base font-medium w-full transition-all shadow-sm ${
                    itemStatuses[popupInfo.type === 'biz' ? popupInfo.code_id : (popupInfo.type === 'home' ? (popupInfo.code_id || `home-${popupInfo.lat}-${popupInfo.lon}`) : `badge-${popupInfo.lat}-${popupInfo.lon}`)] === 'found'
                      ? 'bg-gray-500 hover:bg-gray-600 ring-2 ring-gray-400 ring-offset-2' 
                      : (popupInfo.type === 'biz' ? 'bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-500 ring-offset-2' : (popupInfo.type === 'home' ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-500 ring-offset-2' : 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-500 ring-offset-2'))
                  }`}
                >
                  {itemStatuses[popupInfo.type === 'biz' ? popupInfo.code_id : (popupInfo.type === 'home' ? (popupInfo.code_id || `home-${popupInfo.lat}-${popupInfo.lon}`) : `badge-${popupInfo.lat}-${popupInfo.lon}`)] === 'found' ? "✓ Found (Undo)" : "Mark as Found"}
                </button>

                <button 
                  onClick={() => {
                    const id = popupInfo.type === 'biz' ? popupInfo.code_id : (popupInfo.type === 'home' ? (popupInfo.code_id || `home-${popupInfo.lat}-${popupInfo.lon}`) : `badge-${popupInfo.lat}-${popupInfo.lon}`);
                    const currentStatus = itemStatuses[id];
                    onSetItemStatus(id, currentStatus === 'not_found' ? null : 'not_found');
                    setPopupInfo(null);
                  }}
                  className={`px-4 py-3 text-white rounded-lg text-base font-medium w-full transition-all shadow-sm ${
                    itemStatuses[popupInfo.type === 'biz' ? popupInfo.code_id : (popupInfo.type === 'home' ? (popupInfo.code_id || `home-${popupInfo.lat}-${popupInfo.lon}`) : `badge-${popupInfo.lat}-${popupInfo.lon}`)] === 'not_found'
                      ? 'bg-red-500 hover:bg-red-600 ring-2 ring-red-400 ring-offset-2' 
                      : 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-300'
                  }`}
                >
                  {itemStatuses[popupInfo.type === 'biz' ? popupInfo.code_id : (popupInfo.type === 'home' ? (popupInfo.code_id || `home-${popupInfo.lat}-${popupInfo.lon}`) : `badge-${popupInfo.lat}-${popupInfo.lon}`)] === 'not_found' ? "✕ Not Found (Undo)" : "Mark as Not Found"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
