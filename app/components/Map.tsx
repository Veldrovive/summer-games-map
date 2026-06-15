"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import MapGL, { Marker, Source, Layer, MapRef } from "react-map-gl/maplibre";
import { Locate, LocateFixed } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ItemStatus } from "../hooks/useProgress";
import { BizCode, HomeCode, Badge } from "../hooks/useMapData";
import { RoutePoint } from "../lib/RoutingEngine";


type MapProps = {
  center: { lat: number; lon: number };
  liveLocation?: { lat: number; lon: number } | null;
  bizcodes: BizCode[];
  homecodes: HomeCode[];
  badges: Badge[];
  itemStatuses: Record<string, ItemStatus>;
  onSetItemStatus: (id: string, status: ItemStatus | null) => void;
  itemMetadata: Record<string, { notes?: string; code?: string; entered?: boolean }>;
  onSetItemMetadata: (id: string, metadata: { notes?: string; code?: string; entered?: boolean }) => void;

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


export default function Map({
  center,
  liveLocation,
  bizcodes,
  homecodes,
  badges,
  itemStatuses,
  onSetItemStatus,
  itemMetadata,
  onSetItemMetadata,
  routeMode,
  routePoints,
  routeGeoJSON,
  onAddRoutePoint
}: MapProps) {
  const [popupInfo, setPopupInfo] = useState<any>(null);
  const [cursor, setCursor] = useState<string>('');

  const mapRef = useRef<MapRef>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (isFollowing && liveLocation && mapRef.current) {
      mapRef.current.flyTo({ center: [liveLocation.lon, liveLocation.lat], zoom: 15 });
    }
  }, [liveLocation, isFollowing]);

  const onDragStart = useCallback(() => {
    setIsFollowing(false);
  }, []);

  const handleMarkerClick = (e: any, item: any, type: string) => {
    if (e.originalEvent) {
      e.originalEvent.stopPropagation();
    }

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

  const getRouteSequenceNumber = useCallback((id: string) => {
    if (!routeMode) return undefined;
    const idx = routePoints.findIndex(p => p.id === id);
    return idx !== -1 ? idx + 1 : undefined;
  }, [routeMode, routePoints]);

  const redemptionPercentiles = useMemo(() => {
    const allRedemptions = [...bizcodes, ...homecodes]
      .map(item => parseInt((item as any).num_redemptions) || 0)
      .sort((a, b) => a - b);

    if (allRedemptions.length === 0) return { p20: 0, p40: 0, p60: 0, p80: 0 };

    const getPercentile = (p: number) => {
      const idx = Math.floor(p * allRedemptions.length);
      return allRedemptions[Math.min(idx, allRedemptions.length - 1)];
    };

    return {
      p20: getPercentile(0.2),
      p40: getPercentile(0.4),
      p60: getPercentile(0.6),
      p80: getPercentile(0.8)
    };
  }, [bizcodes, homecodes]);

  const geojsonFeatures = useMemo(() => {
    const features: any[] = [];

    bizcodes.forEach((biz) => {
      const id = biz.code_id;
      const status = itemStatuses[id];
      const isEntered = itemMetadata[id]?.entered;
      const seq = getRouteSequenceNumber(id);

      let bgColor = '#a855f7'; // purple-500
      if (seq !== undefined) {
        bgColor = '#3b82f6'; // blue-500
      } else if (isEntered) {
        bgColor = '#4b5563'; // gray-600
      } else if (status === 'found') {
        bgColor = '#9ca3af'; // gray-400
      } else if (status === 'not_found') {
        bgColor = '#ef4444'; // red-500
      }

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [parseFloat(biz.lon), parseFloat(biz.lat)] },
        properties: {
          ...biz,
          itemType: 'biz',
          color: bgColor,
          isRouteSelected: seq !== undefined,
          seqNum: seq !== undefined ? seq : ''
        }
      });
    });

    homecodes.forEach((home) => {
      const id = home.code_id || `home-${home.lat}-${home.lon}`;
      const status = itemStatuses[id];
      const isEntered = itemMetadata[id]?.entered;
      const seq = getRouteSequenceNumber(id);

      let bgColor = '#10b981'; // emerald-500
      if (seq !== undefined) bgColor = '#3b82f6';
      else if (isEntered) bgColor = '#4b5563';
      else if (status === 'found') bgColor = '#9ca3af';
      else if (status === 'not_found') bgColor = '#ef4444';

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [parseFloat(home.lon), parseFloat(home.lat)] },
        properties: {
          ...home,
          itemType: 'home',
          color: bgColor,
          isRouteSelected: seq !== undefined,
          seqNum: seq !== undefined ? seq : ''
        }
      });
    });

    badges.forEach((badge) => {
      const id = `badge-${badge.lat}-${badge.lon}`;
      const status = itemStatuses[id];
      const isEntered = itemMetadata[id]?.entered;
      const seq = getRouteSequenceNumber(id);

      let bgColor = '#f59e0b'; // amber-500
      if (seq !== undefined) bgColor = '#3b82f6';
      else if (isEntered) bgColor = '#4b5563';
      else if (status === 'found') bgColor = '#9ca3af';
      else if (status === 'not_found') bgColor = '#ef4444';

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [parseFloat(badge.lon), parseFloat(badge.lat)] },
        properties: {
          ...badge,
          itemType: 'badge',
          color: bgColor,
          isRouteSelected: seq !== undefined,
          seqNum: seq !== undefined ? seq : ''
        }
      });
    });

    return {
      type: 'FeatureCollection' as const,
      features
    };
  }, [bizcodes, homecodes, badges, itemStatuses, itemMetadata, getRouteSequenceNumber]);

  const onMapClick = useCallback((e: any) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      const { itemType, color, isRouteSelected, seqNum, ...itemProps } = feature.properties;

      // Call existing handleMarkerClick logic
      handleMarkerClick(e, itemProps, itemType);
    }
  }, [routeMode, onAddRoutePoint]); // Ensure closure bindings are fresh or map correctly

  const onMouseEnter = useCallback(() => setCursor('pointer'), []);
  const onMouseLeave = useCallback(() => setCursor(''), []);

  return (
    <div id="tour-map" className="relative w-full h-full">
      <MapGL
        ref={mapRef}
        initialViewState={{
          longitude: center.lon,
          latitude: center.lat,
          zoom: 13
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={osmStyle}
        mapLib={maplibregl}
        cursor={cursor}
        interactiveLayerIds={['markers-circles']}
        onClick={onMapClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onDragStart={onDragStart}
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

        {/* Live Location Marker */}
        {liveLocation && (
          <Marker longitude={liveLocation.lon} latitude={liveLocation.lat} anchor="center" style={{ zIndex: 50 }}>
            <div className="relative flex justify-center items-center">
              <div className="absolute w-8 h-8 bg-blue-500 rounded-full animate-ping opacity-75 pointer-events-none"></div>
              <div className="relative w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-md cursor-pointer" title="Live Location"></div>
            </div>
          </Marker>
        )}



        {/* WebGL Markers Layer */}
        <Source id="markers" type="geojson" data={geojsonFeatures}>
          <Layer
            id="markers-circles"
            type="circle"
            paint={{
              'circle-color': ['get', 'color'],
              'circle-radius': ['case', ['get', 'isRouteSelected'], 12, 8],
              'circle-stroke-width': ['case', ['get', 'isRouteSelected'], 3, 2],
              'circle-stroke-color': '#ffffff'
            }}
          />
          <Layer
            id="markers-text"
            type="symbol"
            layout={{
              'text-field': ['to-string', ['get', 'seqNum']],
              'text-size': 12,
              'text-allow-overlap': true
            }}
            paint={{
              'text-color': '#ffffff'
            }}
          />
        </Source>

      </MapGL>

      {/* Follow User Location Button */}
      {liveLocation && (
        <div className="absolute bottom-8 right-8 z-[1000]">
          <button
            onClick={() => setIsFollowing(true)}
            className={`p-3 rounded-full shadow-lg border transition-colors ${isFollowing
              ? 'bg-blue-600 text-white border-blue-700'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            title="Follow My Location"
          >
            {isFollowing ? <LocateFixed className="w-6 h-6" /> : <Locate className="w-6 h-6" />}
          </button>
        </div>
      )}

      {/* Modal Overlay */}
      {popupInfo && !routeMode && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col transform transition-all animate-in zoom-in-95 duration-200">
            {(() => {
              const id = popupInfo.type === 'biz' ? popupInfo.code_id : (popupInfo.type === 'home' ? (popupInfo.code_id || `home-${popupInfo.lat}-${popupInfo.lon}`) : `badge-${popupInfo.lat}-${popupInfo.lon}`);
              const currentStatus = itemStatuses[id];

              const rawContent = popupInfo.type === 'biz' ? popupInfo.bizcode : (popupInfo.type === 'home' ? popupInfo.homecode : popupInfo.popup);
              const displayContent = (popupInfo.type === 'biz' || popupInfo.type === 'home')
                ? rawContent.split(/<br\s*\/?>|\n/i)[0]
                : rawContent;

              const numRedemptions = parseInt(popupInfo.num_redemptions) || 0;
              let usageLabel = 'Unused';
              let usageColor = 'bg-gray-100 text-gray-600 border-gray-200';

              if (numRedemptions > redemptionPercentiles.p80) {
                usageLabel = 'Very High';
                usageColor = 'bg-red-100 text-red-700 border-red-200';
              } else if (numRedemptions > redemptionPercentiles.p60) {
                usageLabel = 'High';
                usageColor = 'bg-orange-100 text-orange-700 border-orange-200';
              } else if (numRedemptions > redemptionPercentiles.p40) {
                usageLabel = 'Medium';
                usageColor = 'bg-yellow-100 text-yellow-800 border-yellow-200';
              } else if (numRedemptions > redemptionPercentiles.p20) {
                usageLabel = 'Low';
                usageColor = 'bg-blue-100 text-blue-700 border-blue-200';
              } else if (numRedemptions > 0) {
                usageLabel = 'Rarely Used';
                usageColor = 'bg-gray-100 text-gray-600 border-gray-200';
              }

              return (
                <>
                  <div className="flex justify-between items-center p-5 border-b bg-gray-50/80 backdrop-blur shrink-0">
                    <h3 className="font-extrabold text-xl text-gray-800 tracking-tight">
                      {popupInfo.type === 'biz' ? 'Business Code' : (popupInfo.type === 'home' ? 'Home Code' : 'Badge')}
                    </h3>
                    <button
                      onClick={() => setPopupInfo(null)}
                      className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                      aria-label="Close modal"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto max-h-[75vh]">
                    {popupInfo.type === 'badge' && popupInfo.image && (
                      <img src={`https://aadl.org${popupInfo.image}`} alt="Badge" className="w-32 h-32 object-contain mb-6 mx-auto drop-shadow-lg" />
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6 text-center">
                      <div
                        dangerouslySetInnerHTML={{ __html: displayContent }}
                        className={`text-gray-800 text-xl font-medium prose prose-sm max-w-none mx-auto`}
                      />
                    </div>

                    {(popupInfo.type !== 'badge' || popupInfo.created) && (
                      <div className="bg-gray-50 rounded-xl p-1 mb-6 border border-gray-100 flex flex-col">
                        {popupInfo.type !== 'badge' && (
                          <div className="flex items-center justify-between py-3 px-4 border-b border-gray-200 last:border-0">
                            <div className="flex items-center gap-6">
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Redemptions</span>
                              <span className="text-lg font-bold text-gray-800">{numRedemptions.toLocaleString()}</span>
                            </div>
                            <div className={`px-3 py-1.5 rounded-full border text-xs font-bold shadow-sm whitespace-nowrap ${usageColor}`}>
                              {usageLabel}
                            </div>
                          </div>
                        )}
                        {popupInfo.created && (
                          <div className="flex items-center justify-between py-3 px-4 border-b border-gray-200 last:border-0">
                            <div className="flex items-center gap-6">
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Created</span>
                              <span className="text-lg font-bold text-gray-800">
                                {(() => {
                                  const d = new Date(Number(popupInfo.created) * 1000);
                                  const day = d.getDate();
                                  const suffix = ['th', 'st', 'nd', 'rd'][(day > 3 && day < 21) || day % 10 > 3 ? 0 : day % 10];
                                  return `${d.toLocaleDateString('en-US', { month: 'long' })} ${day}${suffix}`;
                                })()}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-4 bg-gray-50 p-5 rounded-xl border border-gray-100">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-sm font-bold text-gray-700">Code (optional):</span>
                          <input
                            type="text"
                            placeholder="Enter the code..."
                            value={itemMetadata[id]?.code || ''}
                            onChange={(e) => onSetItemMetadata(id, { ...(itemMetadata[id] || {}), code: e.target.value })}
                            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-sm font-bold text-gray-700">Notes (optional):</span>
                          <textarea
                            placeholder="Add generic notes here..."
                            value={itemMetadata[id]?.notes || ''}
                            onChange={(e) => onSetItemMetadata(id, { ...(itemMetadata[id] || {}), notes: e.target.value })}
                            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none min-h-[80px]"
                          />
                        </label>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex gap-3 w-full">
                          <button
                            onClick={() => {
                              onSetItemStatus(id, currentStatus === 'found' ? null : 'found');
                              setPopupInfo(null);
                            }}
                            className={`flex-1 px-4 py-3.5 text-white rounded-xl text-sm font-bold transition-all shadow-sm ${currentStatus === 'found'
                              ? 'bg-gray-500 hover:bg-gray-600 ring-2 ring-gray-400 ring-offset-2'
                              : (popupInfo.type === 'biz' ? 'bg-purple-600 hover:bg-purple-700' : (popupInfo.type === 'home' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'))
                              }`}
                          >
                            {currentStatus === 'found' ? "✓ Found" : "Found"}
                          </button>

                          <button
                            onClick={() => {
                              const isEntered = itemMetadata[id]?.entered;
                              if (isEntered) {
                                onSetItemMetadata(id, { entered: false });
                              } else {
                                if (currentStatus !== 'found') onSetItemStatus(id, 'found');
                                onSetItemMetadata(id, { entered: true });
                              }
                              setPopupInfo(null);
                            }}
                            className={`flex-1 px-4 py-3.5 text-white rounded-xl text-sm font-bold transition-all shadow-sm ${itemMetadata[id]?.entered
                              ? 'bg-gray-600 hover:bg-gray-700 ring-2 ring-gray-500 ring-offset-2'
                              : (popupInfo.type === 'biz' ? 'bg-purple-800 hover:bg-purple-900' : (popupInfo.type === 'home' ? 'bg-emerald-800 hover:bg-emerald-900' : 'bg-amber-700 hover:bg-amber-800'))
                              }`}
                          >
                            {itemMetadata[id]?.entered ? "✓ Entered" : "Found & Entered"}
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            onSetItemStatus(id, currentStatus === 'not_found' ? null : 'not_found');
                            setPopupInfo(null);
                          }}
                          className={`px-4 py-3.5 rounded-xl text-sm font-bold w-full transition-all shadow-sm ${currentStatus === 'not_found'
                            ? 'bg-red-500 hover:bg-red-600 text-white ring-2 ring-red-400 ring-offset-2'
                            : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
                            }`}
                        >
                          {currentStatus === 'not_found' ? "✕ Not Found (Undo)" : "Mark as Not Found"}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
