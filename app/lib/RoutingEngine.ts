import PathFinder from 'geojson-path-finder';
import * as turf from '@turf/turf';

export interface RoutePoint {
  id: string;
  lat: number;
  lon: number;
  name?: string;
}

export class RoutingEngine {
  private pathFinder: any = null;
  private networkVertices: any = null;
  public isReady: boolean = false;

  async init() {
    if (this.isReady) return;
    try {
      const response = await fetch('/ann_arbor_network.json');
      if (!response.ok) throw new Error('Failed to load network data');
      const data = await response.json();
      
      this.pathFinder = new PathFinder(data, {
        precision: 1e-5
      });
      
      // Extract all vertices for snapping
      const vertices: any[] = [];
      turf.geomEach(data, (geom) => {
        if (geom.type === 'LineString') {
           geom.coordinates.forEach(coord => {
              vertices.push(turf.point(coord));
           });
        }
      });
      this.networkVertices = turf.featureCollection(vertices);
      this.isReady = true;
    } catch (e) {
      console.error('Failed to init routing engine', e);
    }
  }

  snapPoint(coords: [number, number]): [number, number] {
     if (!this.isReady) return coords;
     const pt = turf.point(coords);
     const snapped = turf.nearestPoint(pt, this.networkVertices);
     return snapped.geometry.coordinates as [number, number];
  }

  findPath(startCoords: [number, number], endCoords: [number, number]) {
     if (!this.isReady) return null;
     const snappedStart = this.snapPoint(startCoords);
     const snappedEnd = this.snapPoint(endCoords);
     
     const startPt = turf.point(snappedStart);
     const endPt = turf.point(snappedEnd);
     
     try {
       const path = this.pathFinder.findPath(startPt, endPt);
       return path; // { path: [...coords], weight: distance }
     } catch (e) {
       console.error("Pathfinder error:", e);
       return null;
     }
  }

  // Calculate full route for a sequence of points
  calculateSequence(points: RoutePoint[]) {
    if (!this.isReady || points.length < 2) return null;
    let fullPath: number[][] = [];
    let totalWeight = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const start = [points[i].lon, points[i].lat] as [number, number];
      const end = [points[i+1].lon, points[i+1].lat] as [number, number];
      const result = this.findPath(start, end);
      
      if (result && result.path) {
        // Avoid duplicating the connecting node
        const segment = i === 0 ? result.path : result.path.slice(1);
        fullPath = fullPath.concat(segment);
        totalWeight += result.weight;
      }
    }
    
    if (fullPath.length === 0) return null;

    return {
      type: "Feature" as const,
      properties: { weight: totalWeight },
      geometry: {
        type: "LineString" as const,
        coordinates: fullPath
      }
    };
  }

  // TSP Optimization
  optimizeRoute(points: RoutePoint[]): RoutePoint[] {
    if (!this.isReady || points.length <= 2) return points;

    const n = points.length;
    // Step 1: Straight-line distance matrix
    const geoMatrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = turf.distance(
          turf.point([points[i].lon, points[i].lat]),
          turf.point([points[j].lon, points[j].lat])
        );
        geoMatrix[i][j] = d;
        geoMatrix[j][i] = d;
      }
    }

    // Step 2: Nearest Neighbor on geographic distance
    let unvisited = new Set(Array.from({length: n}, (_, i) => i));
    const currPath: number[] = [0];
    unvisited.delete(0);

    let curr = 0;
    while (unvisited.size > 0) {
      let nearest = -1;
      let minDist = Infinity;
      for (const next of unvisited) {
        if (geoMatrix[curr][next] < minDist) {
          minDist = geoMatrix[curr][next];
          nearest = next;
        }
      }
      currPath.push(nearest);
      unvisited.delete(nearest);
      curr = nearest;
    }

    // Step 3: Refine with real path distances for points close in the sequence
    // As per user request: compute real distance only between known close-to-optimal route
    // We compute real distance for nodes that are within a window of W in the current path.
    const realMatrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(Infinity));
    const WINDOW = 3;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const idxA = currPath.indexOf(i);
        const idxB = currPath.indexOf(j);
        
        // If they are close in the initial route sequence, compute real distance
        if (Math.abs(idxA - idxB) <= WINDOW) {
          const res = this.findPath(
            [points[i].lon, points[i].lat], 
            [points[j].lon, points[j].lat]
          );
          const realDist = res ? res.weight : Infinity;
          realMatrix[i][j] = realDist;
          realMatrix[j][i] = realDist;
        }
      }
    }

    // Run 2-opt on the refined matrix to polish the route
    let improved = true;
    let bestPath = [...currPath];
    let bestDist = this.pathDistance(bestPath, realMatrix);

    while (improved) {
      improved = false;
      for (let i = 1; i < n - 1; i++) {
        for (let j = i + 1; j < n; j++) {
          const newPath = this.twoOptSwap(bestPath, i, j);
          const newDist = this.pathDistance(newPath, realMatrix);
          if (newDist < bestDist) {
            bestDist = newDist;
            bestPath = newPath;
            improved = true;
          }
        }
      }
    }

    return bestPath.map(idx => points[idx]);
  }

  private pathDistance(path: number[], matrix: number[][]): number {
    let dist = 0;
    for (let i = 0; i < path.length - 1; i++) {
      dist += matrix[path[i]][path[i+1]];
    }
    return dist;
  }

  private twoOptSwap(path: number[], i: number, k: number): number[] {
    const newPath = path.slice(0, i);
    const reversed = path.slice(i, k + 1).reverse();
    newPath.push(...reversed);
    newPath.push(...path.slice(k + 1));
    return newPath;
  }
}

// Singleton instance
export const routingEngine = new RoutingEngine();
