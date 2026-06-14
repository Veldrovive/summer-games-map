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
  itemMetadata: Record<string, { notes?: string; code?: string }>;
  onSetItemMetadata: (id: string, metadata: { notes?: string; code?: string }) => void;

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

  const geojsonFeatures = useMemo(() => {
    const features: any[] = [];

    bizcodes.forEach((biz) => {
      const id = biz.code_id;
      const status = itemStatuses[id];
      const seq = getRouteSequenceNumber(id);

      let bgColor = '#3b82f6';
      if (seq !== undefined) {
        bgColor = '#8b5cf6';
      } else if (status === 'found' || status === 'entered') {
        bgColor = '#9ca3af';
      } else if (status === 'not_found') {
        bgColor = '#ef4444';
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
      const seq = getRouteSequenceNumber(id);

      let bgColor = '#10b981';
      if (seq !== undefined) bgColor = '#8b5cf6';
      else if (status === 'found' || status === 'entered') bgColor = '#9ca3af';
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
      const seq = getRouteSequenceNumber(id);

      let bgColor = '#f59e0b';
      if (seq !== undefined) bgColor = '#8b5cf6';
      else if (status === 'found' || status === 'entered') bgColor = '#9ca3af';
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
  }, [bizcodes, homecodes, badges, itemStatuses, getRouteSequenceNumber]);

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
    <div className="relative w-full h-full">
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
            className={`p-3 rounded-full shadow-lg border transition-colors ${
              isFollowing 
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

              <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100">
                <div
                  dangerouslySetInnerHTML={{
                    __html: "Number of redemptions: " + popupInfo.num_redemptions
                  }}
                  className={`text-gray-800 text-lg ${popupInfo.type === 'badge' ? 'text-center font-medium' : ''} prose prose-sm max-w-none`}
                />
              </div>

              {(() => {
                const id = popupInfo.type === 'biz' ? popupInfo.code_id : (popupInfo.type === 'home' ? (popupInfo.code_id || `home-${popupInfo.lat}-${popupInfo.lon}`) : `badge-${popupInfo.lat}-${popupInfo.lon}`);
                const currentStatus = itemStatuses[id];
                const isFoundOrEntered = currentStatus === 'found' || currentStatus === 'entered';
                return (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-gray-700">Code (optional):</span>
                        <input
                          type="text"
                          placeholder="Enter the code..."
                          value={itemMetadata[id]?.code || ''}
                          onChange={(e) => onSetItemMetadata(id, { code: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-gray-700">Notes (optional):</span>
                        <textarea
                          placeholder="Add generic notes here..."
                          value={itemMetadata[id]?.notes || ''}
                          onChange={(e) => onSetItemMetadata(id, { notes: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 min-h-[60px]"
                        />
                      </label>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => {
                            onSetItemStatus(id, currentStatus === 'found' ? null : 'found');
                            setPopupInfo(null);
                          }}
                          className={`flex-1 px-3 py-3 text-white rounded-lg text-sm font-bold transition-all shadow-sm ${currentStatus === 'found'
                            ? 'bg-gray-500 hover:bg-gray-600 ring-2 ring-gray-400 ring-offset-2'
                            : (popupInfo.type === 'biz' ? 'bg-blue-600 hover:bg-blue-700' : (popupInfo.type === 'home' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'))
                            }`}
                        >
                          {currentStatus === 'found' ? "✓ Found" : "Found"}
                        </button>

                        <button
                          onClick={() => {
                            onSetItemStatus(id, currentStatus === 'entered' ? null : 'entered');
                            setPopupInfo(null);
                          }}
                          className={`flex-1 px-3 py-3 text-white rounded-lg text-sm font-bold transition-all shadow-sm ${currentStatus === 'entered'
                            ? 'bg-gray-800 hover:bg-gray-900 ring-2 ring-gray-700 ring-offset-2'
                            : (popupInfo.type === 'biz' ? 'bg-blue-800 hover:bg-blue-900' : (popupInfo.type === 'home' ? 'bg-emerald-800 hover:bg-emerald-900' : 'bg-amber-800 hover:bg-amber-900'))
                            }`}
                        >
                          {currentStatus === 'entered' ? "✓ Entered" : "Found & Entered"}
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          onSetItemStatus(id, currentStatus === 'not_found' ? null : 'not_found');
                          setPopupInfo(null);
                        }}
                        className={`px-4 py-3 text-white rounded-lg text-base font-medium w-full transition-all shadow-sm ${currentStatus === 'not_found'
                          ? 'bg-red-500 hover:bg-red-600 ring-2 ring-red-400 ring-offset-2'
                          : 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-300'
                          }`}
                      >
                        {currentStatus === 'not_found' ? "✕ Not Found (Undo)" : "Mark as Not Found"}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
