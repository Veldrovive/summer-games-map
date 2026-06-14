import { useState, useCallback, useEffect } from 'react';
import { RoutePoint, routingEngine } from '../lib/RoutingEngine';

export function useRouting() {
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('savedRoutePoints');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });
  const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [isEngineReady, setIsEngineReady] = useState(false);

  useEffect(() => {
    routingEngine.init().then(() => {
      setIsEngineReady(true);
      // If we loaded route points from localStorage, automatically recalculate the path line
      if (routePoints.length >= 2) {
        setTimeout(() => {
          const geojson = routingEngine.calculateSequence(routePoints);
          setRouteGeoJSON(geojson);
        }, 50);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('savedRoutePoints', JSON.stringify(routePoints));
    }
  }, [routePoints]);

  const addPoint = useCallback((point: RoutePoint) => {
    setRoutePoints(prev => {
      if (prev.find(p => p.id === point.id)) return prev;
      return [...prev, point];
    });
  }, []);

  const removePoint = useCallback((id: string) => {
    setRoutePoints(prev => prev.filter(p => p.id !== id));
  }, []);

  const clearRoute = useCallback(() => {
    setRoutePoints([]);
    setRouteGeoJSON(null);
  }, []);

  const calculateRoute = useCallback(async (optimize: boolean = false) => {
    if (routePoints.length < 2 || !isEngineReady) return;
    
    setIsRouting(true);
    
    // Use setTimeout to allow UI to render loading state
    setTimeout(() => {
      let finalPoints = [...routePoints];
      if (optimize) {
        finalPoints = routingEngine.optimizeRoute(finalPoints);
        setRoutePoints(finalPoints);
      }
      
      const geojson = routingEngine.calculateSequence(finalPoints);
      setRouteGeoJSON(geojson);
      setIsRouting(false);
    }, 100);
  }, [routePoints, isEngineReady]);

  // If a user selects "plan a route between all currently visible ones"
  const setAllVisible = useCallback((points: RoutePoint[]) => {
    // Cap at 25 points to avoid freezing, as per plan. (Wait, user said: "Yea maybe we have this be a N-closest option.")
    // So if points > N, we'll sort them by distance to current center if available, or just take first N.
    // In the page, we will pass the N-closest points.
    setRoutePoints(points);
  }, []);

  return {
    routePoints,
    routeGeoJSON,
    isRouting,
    isEngineReady,
    addPoint,
    removePoint,
    clearRoute,
    calculateRoute,
    setAllVisible
  };
}
