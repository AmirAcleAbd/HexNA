import React, { useEffect, useRef } from 'react';
import { perfLogger } from './WebConsole';

const IridescentTree = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    points: [],
    staticPoints: [],
    connections: [],
    grid: {},
    ctx: null as CanvasRenderingContext2D | null,
    cellSize: 30,
    canvasWidth: 0,
    canvasHeight: 0,
    frameCount: 0,
    lastGridUpdate: 0,
    lastFrame: 0,
    animationFrame: 0,
    MIN_DISTANCE: 5,
    MAX_DISTANCE: 30,
    GRID_UPDATE_INTERVAL: 32,
    TARGET_FPS: 60,
    lastPerformanceLog: 0,
    PERF_LOG_INTERVAL: 1000, // Log performance every second
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const state = stateRef.current;
    state.ctx = ctx;

    const cosCache = new Float32Array(360);
    const sinCache = new Float32Array(360);
    for (let i = 0; i < 360; i++) {
      const rad = (i * Math.PI) / 180;
      cosCache[i] = Math.cos(rad);
      sinCache[i] = Math.sin(rad);
    }

    const getCos = (angle: number) => cosCache[Math.floor((angle * 180) / Math.PI) % 360];
    const getSin = (angle: number) => sinCache[Math.floor((angle * 180) / Math.PI) % 360];

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

    const getCellKey = (x: number, y: number) => `${Math.floor(x / state.cellSize)},${Math.floor(y / state.cellSize)}`;

    const updateSpatialGrid = (points: any[]) => {
      const newGrid: Record<string, any[]> = {};
      for (const point of points) {
        const key = getCellKey(point.x, point.y);
        if (!newGrid[key]) newGrid[key] = [];
        newGrid[key].push(point);
      }
      state.grid = newGrid;
    };

    const getNearbyPoints = (point: any) => {
      const nearby = [];
      const cellX = Math.floor(point.x / state.cellSize);
      const cellY = Math.floor(point.y / state.cellSize);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${cellX + dx},${cellY + dy}`;
          if (state.grid[key]) {
            nearby.push(...state.grid[key]);
          }
        }
      }
      return nearby;
    };

    const cacheConnections = (points: any[]) => {
      const connections = [];
      const MAX_DISTANCE_SQ = state.MAX_DISTANCE * state.MAX_DISTANCE;

      points.forEach((point, i) => {
        const nearby = getNearbyPoints(point);
        nearby.forEach(other => {
          if (other.index <= i) return;

          const dx = other.x - point.x;
          const dy = other.y - point.y;
          const distSq = dx * dx + dy * dy;

          if (distSq > state.MIN_DISTANCE && distSq < MAX_DISTANCE_SQ) {
            const density = (point.density + other.density) / 2;
            const baseAlpha = (1 - Math.sqrt(distSq) / state.MAX_DISTANCE) * density;

            connections.push({
              p1: point,
              p2: other,
              distSq,
              baseAlpha,
              density,
              hue: (point.hue + other.hue) / 2,
              lineWidth: Math.min(2.5 * density, 2.5),
              cached_color: null
            });
          }
        });
      });

      state.connections = connections;
    };

    const createTreeStructure = () => {
      const points = [];
      const baseX = state.canvasWidth / 2;
      const baseY = state.canvasHeight * 0.95;
      const height = state.canvasHeight * 0.95;
      let pointIndex = 0;

      const addBranch = (
        startX: number,
        startY: number,
        angle: number,
        length: number,
        width: number,
        density = 1,
        level = 0
      ) => {
        const pointCount = Math.floor(length / 8) * density;
        const branchPoints = [];

        for (let i = 0; i < pointCount; i++) {
          const t = i / pointCount;
          const spread = Math.sin(t * Math.PI) * width * (1 - t * 0.7);
          const waveMagnitude = width * 0.15 * (1 - t);

          const curveAngle = angle + Math.sin(t * Math.PI) * 0.3;
          const x = startX + getCos(curveAngle) * t * length;
          const y = startY - getSin(curveAngle) * t * length;

          const point = {
            x, y,
            originalX: x,
            originalY: y,
            waveMagnitude,
            density: Math.max(0.3, density * (1 - t * 0.4)),
            hue: 200 + Math.random() * 160,
            level,
            phase: Math.random() * Math.PI * 2,
            index: pointIndex++,
            movementScale: (1 - density * (1 - t * 0.4)) * 2.5
          };

          branchPoints.push(point);
        }

        points.push(...branchPoints);

        if (level < 5 && length > 15) {
          const subBranches = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < subBranches; i++) {
            const t = 0.2 + Math.random() * 0.5;
            const subStartX = startX + getCos(angle) * t * length;
            const subStartY = startY - getSin(angle) * t * length;
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

      addBranch(baseX, baseY, Math.PI / 2, height * 0.4, 20, 1.4, 0);
      const mainBranches = 4;
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
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const basePoint = staticPoints[i];
        const t = time + point.phase;

        point.x = basePoint.originalX + Math.sin(time + t * 5) * point.waveMagnitude;
        point.y = basePoint.originalY + point.movementScale * Math.cos(t * 3);
      }
    };

    const drawConnections = () => {
        const drawStartTime = performance.now();

        const previousCompositeOperation = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'lighter';
        
        const connections = state.connections;
        const len = connections.length;
        
        const loopStartTime = performance.now();
        for (let i = 0; i < len; i++) {
          const conn = connections[i];
          const alpha = conn.baseAlpha;
          
          if (alpha > 0.05) {
            if (!conn.cached_color) {
              conn.cached_color = conn.density > 0.7 
                ? `rgba(255,255,255,${alpha * 0.9})`
                : `hsla(${conn.hue},75%,70%,${alpha * 0.7})`;
            }
            
            ctx.beginPath();
            ctx.strokeStyle = conn.cached_color;
            ctx.lineWidth = conn.lineWidth;
            ctx.moveTo(conn.p1.x, conn.p1.y);
            ctx.lineTo(conn.p2.x, conn.p2.y);
            ctx.stroke();
          }
        }

        const loopEndTime = performance.now();
        perfLogger.log(`Total Loop time: ${(loopEndTime - loopStartTime).toFixed(2)}ms`);
        ctx.globalCompositeOperation = previousCompositeOperation;
        const drawEndTime = performance.now();
        perfLogger.log(`Total DrawConnections Time: ${(drawEndTime - drawStartTime).toFixed(2)}ms`);
    };

    const animate = (timestamp: number) => {
      const elapsed = timestamp - state.lastFrame;
      const frameInterval = 1000 / state.TARGET_FPS;

      if (elapsed > frameInterval) {
        state.lastFrame = timestamp - (elapsed % frameInterval);
        state.frameCount++;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);

        const updateStart = performance.now();
        updatePoints(timestamp * 0.001);
        updateSpatialGrid(state.points);
        const updateEnd = performance.now();

        const drawStart = performance.now();
        drawConnections();
        const drawEnd = performance.now();

        if (timestamp - state.lastPerformanceLog > state.PERF_LOG_INTERVAL) {
          const fps = (1000 / elapsed).toFixed(1);
          perfLogger.log(`FPS: ${fps}, Update: ${(updateEnd - updateStart).toFixed(2)}ms, Draw: ${(drawEnd - drawStart).toFixed(2)}ms`);
          state.lastPerformanceLog = timestamp;
        }
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
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};

export default IridescentTree;
