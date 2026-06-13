"use client";

import { useMemo, useState } from "react";
import MapGL, { Marker, Popup, Source, Layer } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BizCode, HomeCode, Badge } from "../hooks/useMapData";
import { RoutePoint } from "../lib/RoutingEngine";

type MapProps = {
  center: { lat: number; lon: number };
  bizcodes: BizCode[];
  homecodes: HomeCode[];
  badges: Badge[];
  checkedItems: Set<string>;
  onToggleCheck: (id: string) => void;
  
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

const createDot = (color: string, isChecked: boolean, isRouteSelected: boolean, seqNum?: number) => {
  return (
    <div style={{
      backgroundColor: isRouteSelected ? '#8b5cf6' : (isChecked ? '#9ca3af' : color),
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
  checkedItems, 
  onToggleCheck,
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
    const idx = routePoints.findIndex(p => p.id === id);
    return idx !== -1 ? idx + 1 : undefined;
  };

  return (
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
      {routeGeoJSON && (
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
        const isChecked = checkedItems.has(id);
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
            {createDot('#3b82f6', isChecked, seq !== undefined, seq)}
          </Marker>
        );
      })}

      {homecodes.map((home) => {
        const id = home.code_id || `home-${home.lat}-${home.lon}`;
        const isChecked = checkedItems.has(id);
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
            {createDot('#10b981', isChecked, seq !== undefined, seq)}
          </Marker>
        );
      })}

      {badges.map((badge) => {
        const id = `badge-${badge.lat}-${badge.lon}`;
        const isChecked = checkedItems.has(id);
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
            {createDot('#f59e0b', isChecked, seq !== undefined, seq)}
          </Marker>
        );
      })}

      {/* Popups */}
      {popupInfo && !routeMode && (
        <Popup
          anchor="bottom"
          longitude={parseFloat(popupInfo.lon)}
          latitude={parseFloat(popupInfo.lat)}
          onClose={() => setPopupInfo(null)}
          closeButton={true}
          closeOnClick={false}
          maxWidth="250px"
        >
          <div className="text-sm min-w-[200px] pt-2">
            {popupInfo.type === 'badge' && popupInfo.image && (
              <img src={`https://aadl.org${popupInfo.image}`} alt="Badge" className="w-20 h-20 object-contain mb-3 mx-auto drop-shadow-md" />
            )}
            <div 
              dangerouslySetInnerHTML={{ 
                __html: popupInfo.type === 'biz' ? popupInfo.bizcode : (popupInfo.type === 'home' ? popupInfo.homecode : popupInfo.popup) 
              }} 
              className={`mb-3 text-gray-800 ${popupInfo.type === 'badge' ? 'text-center font-medium' : ''}`} 
            />
            
            <button 
              onClick={() => {
                const id = popupInfo.type === 'biz' ? popupInfo.code_id : (popupInfo.type === 'home' ? (popupInfo.code_id || `home-${popupInfo.lat}-${popupInfo.lon}`) : `badge-${popupInfo.lat}-${popupInfo.lon}`);
                onToggleCheck(id);
                setPopupInfo(null);
              }}
              className={`px-3 py-2 text-white rounded-md text-sm font-medium w-full transition-colors ${
                checkedItems.has(popupInfo.type === 'biz' ? popupInfo.code_id : (popupInfo.type === 'home' ? (popupInfo.code_id || `home-${popupInfo.lat}-${popupInfo.lon}`) : `badge-${popupInfo.lat}-${popupInfo.lon}`)) 
                  ? 'bg-gray-500 hover:bg-gray-600' 
                  : (popupInfo.type === 'biz' ? 'bg-blue-600 hover:bg-blue-700' : (popupInfo.type === 'home' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'))
              }`}
            >
              {checkedItems.has(popupInfo.type === 'biz' ? popupInfo.code_id : (popupInfo.type === 'home' ? (popupInfo.code_id || `home-${popupInfo.lat}-${popupInfo.lon}`) : `badge-${popupInfo.lat}-${popupInfo.lon}`)) ? "✓ Checked Off (Undo)" : "Check Off"}
            </button>
          </div>
        </Popup>
      )}
    </MapGL>
  );
}
