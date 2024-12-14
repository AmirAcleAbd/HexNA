import React, { useEffect, useRef } from 'react';

const OptimizedIridescentTree = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    points: [] as any[],
    staticPoints: [] as any[],
    connections: [] as any[],
    grid: new Map(),
    ctx: null as CanvasRenderingContext2D | null,
    cellSize: 40, // Increased cell size
    canvasWidth: 0,
    canvasHeight: 0,
    frameCount: 0,
    lastFrame: 0,
    animationFrame: 0,
    // Constants
    MAX_CONNECTIONS_PER_POINT: 6,
    MIN_DISTANCE_SQ: 25, // 5^2
    MAX_DISTANCE_SQ: 1600, // 40^2
    TARGET_FPS: 30
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const state = stateRef.current;
    state.ctx = ctx;

    // Pre-calculate trigonometric values
    const ANGLE_STEPS = 360;
    const trig = new Float32Array(ANGLE_STEPS * 2); // [cos, sin, cos, sin, ...]
    for (let i = 0; i < ANGLE_STEPS; i++) {
      const rad = (i * Math.PI) / 180;
      trig[i * 2] = Math.cos(rad);
      trig[i * 2 + 1] = Math.sin(rad);
    }

    const getTrig = (angle: number) => {
      const index = (Math.floor((angle * 180) / Math.PI) % 360) * 2;
      return [trig[index], trig[index + 1]];
    };

    const updateSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const newWidth = rect.width * dpr;
      const newHeight = rect.height * dpr;

      if (newWidth !== state.canvasWidth || newHeight !== state.canvasHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        state.canvasWidth = newWidth;
        state.canvasHeight = newHeight;
        createTreeStructure();
      }
    };

    const getCellKey = (x: number, y: number): string => 
      `${Math.floor(x / state.cellSize)},${Math.floor(y / state.cellSize)}`;

    const updateSpatialGrid = (points: any[]) => {
      const grid = new Map();
      const len = points.length;
      
      for (let i = 0; i < len; i++) {
        const point = points[i];
        const key = getCellKey(point.x, point.y);
        const cell = grid.get(key) || [];
        cell.push(point);
        grid.set(key, cell);
      }
      
      state.grid = grid;
    };

    const getNearbyPoints = (point: any): any[] => {
      const nearby: any[] = [];
      const cellX = Math.floor(point.x / state.cellSize);
      const cellY = Math.floor(point.y / state.cellSize);
      
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${cellX + dx},${cellY + dy}`;
          const cell = state.grid.get(key);
          if (cell) nearby.push(...cell);
        }
      }
      return nearby;
    };

    const calculateConnectionProperties = (dx: number, dy: number, p1: any, p2: any) => {
      const distSq = dx * dx + dy * dy;
      const density = (p1.density + p2.density) / 2;
      const baseAlpha = (1 - Math.sqrt(distSq) / Math.sqrt(state.MAX_DISTANCE_SQ)) * density;
      
      return {
        distSq,
        baseAlpha,
        density,
        hue: (p1.hue + p2.hue) / 2,
        lineWidth: Math.min(2.5 * density, 2.5)
      };
    };

    const cacheConnections = (points: any[]) => {
      const connections: any[] = [];
      const len = points.length;
      
      for (let i = 0; i < len; i++) {
        const point = points[i];
        let connectionCount = 0;
        const nearby = getNearbyPoints(point);
        
        for (let j = 0; j < nearby.length && connectionCount < state.MAX_CONNECTIONS_PER_POINT; j++) {
          const other = nearby[j];
          if (other.index <= i) continue;
          
          const dx = other.x - point.x;
          const dy = other.y - point.y;
          const distSq = dx * dx + dy * dy;
          
          if (distSq > state.MIN_DISTANCE_SQ && distSq < state.MAX_DISTANCE_SQ) {
            const props = calculateConnectionProperties(dx, dy, point, other);
            if (props.baseAlpha > 0.05) {
              connectionCount++;
              connections.push({
                p1: point,
                p2: other,
                ...props,
                cached_color: null
              });
            }
          }
        }
      }
      
      state.connections = connections;
    };

    const createTreeStructure = () => {
      const points: any[] = [];
      const baseX = state.canvasWidth / 2;
      const baseY = state.canvasHeight * 0.95;
      const height = state.canvasHeight * 0.95;
      let pointIndex = 0;

      const createPoint = (x: number, y: number, density: number, level: number) => ({
        x, y,
        originalX: x,
        originalY: y,
        density,
        hue: 200 + Math.random() * 160,
        level,
        phase: Math.random() * Math.PI * 2,
        index: pointIndex++,
        waveMagnitude: (1 - density) * 3
      });

      const addBranch = (
        startX: number,
        startY: number,
        angle: number,
        length: number,
        width: number,
        density = 1,
        level = 0
      ) => {
        const pointCount = Math.floor(length / 12) * density; // Reduced point density
        const branchPoints = [];
        
        for (let i = 0; i < pointCount; i++) {
          const t = i / pointCount;
          const [cos, sin] = getTrig(angle + Math.sin(t * Math.PI) * 0.3);
          
          const x = startX + cos * t * length;
          const y = startY - sin * t * length;
          const pointDensity = Math.max(0.3, density * (1 - t * 0.4));

          branchPoints.push(createPoint(x, y, pointDensity, level));
        }
        
        points.push(...branchPoints);

        if (level < 4 && length > 20) { // Reduced max level
          const subBranches = 2 + Math.floor(Math.random() * 2); // Reduced sub-branches
          for (let i = 0; i < subBranches; i++) {
            const t = 0.2 + Math.random() * 0.5;
            const [cos, sin] = getTrig(angle);
            const subStartX = startX + cos * t * length;
            const subStartY = startY - sin * t * length;
            const spreadAngle = 0.4 + Math.random() * 0.6;
            const subAngle = angle + (i === 0 ? spreadAngle : -spreadAngle);
            
            addBranch(
              subStartX, subStartY,
              subAngle,
              length * 0.65,
              width * 0.75,
              density * 0.85,
              level + 1
            );
          }
        }
      };

      // Create main trunk
      addBranch(baseX, baseY, Math.PI / 2, height * 0.4, 20, 1.4, 0);

      // Create main branches
      const mainBranches = 3; // Reduced from 4
      for (let i = 0; i < mainBranches; i++) {
        const angle = Math.PI / 2 + (i - (mainBranches - 1) / 2) * 0.7;
        addBranch(
          baseX, baseY - height * 0.35,
          angle,
          height * 0.5,
          15,
          1.2,
          1
        );
      }

      state.points = points;
      state.staticPoints = points.map(p => ({ ...p }));
      updateSpatialGrid(points);
      cacheConnections(points);
    };

    const updatePoints = (time: number) => {
      const points = state.points;
      const staticPoints = state.staticPoints;
      const len = points.length;
      
      for (let i = 0; i < len; i++) {
        const point = points[i];
        const basePoint = staticPoints[i];
        const t = time + point.phase;
        
        point.x = basePoint.originalX + Math.sin(time + t * 5) * point.waveMagnitude;
        point.y = basePoint.originalY + Math.cos(t * 3) * point.waveMagnitude;
      }
    };

    const drawConnections = () => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      
      const connections = state.connections;
      const len = connections.length;
      
      for (let i = 0; i < len; i++) {
        const conn = connections[i];
        
        if (!conn.cached_color) {
          conn.cached_color = conn.density > 0.7 
            ? `rgba(255,255,255,${conn.baseAlpha * 0.9})`
            : `hsla(${conn.hue},75%,70%,${conn.baseAlpha * 0.7})`;
        }
        
        ctx.beginPath();
        ctx.strokeStyle = conn.cached_color;
        ctx.lineWidth = conn.lineWidth;
        ctx.moveTo(conn.p1.x, conn.p1.y);
        ctx.lineTo(conn.p2.x, conn.p2.y);
        ctx.stroke();
      }
      
      ctx.restore();
    };

    const animate = (timestamp: number) => {
      const elapsed = timestamp - state.lastFrame;
      const frameInterval = 1000 / state.TARGET_FPS;
      
      if (elapsed >= frameInterval) {
        state.lastFrame = timestamp - (elapsed % frameInterval);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);

        updatePoints(timestamp * 0.001);
        updateSpatialGrid(state.points);
        drawConnections();
      }
      
      state.animationFrame = requestAnimationFrame(animate);
    };

    updateSize();
    state.animationFrame = requestAnimationFrame(animate);
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
      cancelAnimationFrame(state.animationFrame);
    };
  }, []);

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
};

export default OptimizedIridescentTree;