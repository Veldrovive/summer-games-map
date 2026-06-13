import { useState, useEffect } from 'react';

export type BizCode = {
  bizcode: string;
  lat: string;
  lon: string;
  code_id: string;
  created: string;
  num_redemptions: string;
};

export type HomeCode = {
  homecode?: string;
  lat: string;
  lon: string;
  code_id?: string;
  created?: string;
  num_redemptions?: string;
  layerGroup?: string;
};

export type Badge = {
  popup: string;
  lat: string;
  lon: string;
  image: string;
};

export type MapData = {
  homecodes: HomeCode[];
  bizcodes: BizCode[];
  badges: Badge[];
};

export function useMapData() {
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/map-data');
        if (!res.ok) throw new Error('Failed to fetch data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { data, loading, error };
}
