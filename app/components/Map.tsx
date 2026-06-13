"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { BizCode, HomeCode, Badge } from "../hooks/useMapData";

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom icons
const createIcon = (color: string) => {
  return new L.DivIcon({
    className: 'custom-icon',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

const bizIcon = createIcon('#3b82f6'); // blue-500
const homeIcon = createIcon('#10b981'); // emerald-500
const badgeIcon = createIcon('#f59e0b'); // amber-500
const checkedIcon = createIcon('#9ca3af'); // gray-400

type MapProps = {
  center: { lat: number; lon: number };
  bizcodes: BizCode[];
  homecodes: HomeCode[];
  badges: Badge[];
  checkedItems: Set<string>;
  onToggleCheck: (id: string) => void;
};

// Component to recenter map when center changes
function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom());
  }, [lat, lon, map]);
  return null;
}

export default function Map({ center, bizcodes, homecodes, badges, checkedItems, onToggleCheck }: MapProps) {
  return (
    <MapContainer 
      center={[center.lat, center.lon]} 
      zoom={13} 
      style={{ height: '100%', width: '100%', zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter lat={center.lat} lon={center.lon} />

      {/* User Location Marker */}
      <Marker position={[center.lat, center.lon]} icon={createIcon('#ef4444')}>
        <Popup>Your Location</Popup>
      </Marker>

      {bizcodes.map((biz) => {
        const id = biz.code_id;
        const isChecked = checkedItems.has(id);
        return (
          <Marker key={`biz-${id}`} position={[parseFloat(biz.lat), parseFloat(biz.lon)]} icon={isChecked ? checkedIcon : bizIcon}>
            <Popup>
              <div className="text-sm min-w-[200px]">
                <div dangerouslySetInnerHTML={{ __html: biz.bizcode }} className="mb-3 text-gray-800" />
                <button 
                  onClick={() => onToggleCheck(id)}
                  className={`px-3 py-2 text-white rounded-md text-sm font-medium w-full transition-colors ${isChecked ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {isChecked ? "✓ Checked Off (Undo)" : "Check Off"}
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {homecodes.map((home) => {
        const id = home.code_id || `home-${home.lat}-${home.lon}`;
        const isChecked = checkedItems.has(id);
        return (
          <Marker key={id} position={[parseFloat(home.lat), parseFloat(home.lon)]} icon={isChecked ? checkedIcon : homeIcon}>
            <Popup>
              <div className="text-sm min-w-[200px]">
                {home.homecode && <div dangerouslySetInnerHTML={{ __html: home.homecode }} className="mb-3 text-gray-800" />}
                <button 
                  onClick={() => onToggleCheck(id)}
                  className={`px-3 py-2 text-white rounded-md text-sm font-medium w-full transition-colors ${isChecked ? 'bg-gray-500 hover:bg-gray-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                  {isChecked ? "✓ Checked Off (Undo)" : "Check Off"}
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {badges.map((badge) => {
        const id = `badge-${badge.lat}-${badge.lon}`;
        const isChecked = checkedItems.has(id);
        return (
          <Marker key={id} position={[parseFloat(badge.lat), parseFloat(badge.lon)]} icon={isChecked ? checkedIcon : badgeIcon}>
            <Popup>
              <div className="text-sm flex flex-col items-center min-w-[200px]">
                {badge.image && <img src={`https://aadl.org${badge.image}`} alt="Badge" className="w-20 h-20 object-contain mb-3 drop-shadow-md" />}
                <div dangerouslySetInnerHTML={{ __html: badge.popup }} className="mb-3 text-center text-gray-800 font-medium" />
                <button 
                  onClick={() => onToggleCheck(id)}
                  className={`px-3 py-2 text-white rounded-md text-sm font-medium w-full transition-colors ${isChecked ? 'bg-gray-500 hover:bg-gray-600' : 'bg-amber-600 hover:bg-amber-700'}`}
                >
                  {isChecked ? "✓ Checked Off (Undo)" : "Check Off"}
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
