import React, { useEffect, useRef } from 'react';

const StaticIridescentTree = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    points: [] as any[],
    connections: [] as any[],
    grid: {} as Record<string, any[]>,
    ctx: null as CanvasRenderingContext2D | null,
    cellSize: 30,
    canvasWidth: 0,
    canvasHeight: 0,
    // Constants
    MIN_DISTANCE: 5,
    MAX_DISTANCE: 30,
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const state = stateRef.current;
    state.ctx = ctx;

    // Pre-calculate trigonometric values for better performance
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
        drawTree();
      }
    };

    const getCellKey = (x: number, y: number) => 
      `${Math.floor(x / state.cellSize)},${Math.floor(y / state.cellSize)}`;

    const updateSpatialGrid = (points: any[]) => {
      const newGrid: Record<string, any[]> = {};
      
      points.forEach(point => {
        const key = getCellKey(point.x, point.y);
        if (!newGrid[key]) newGrid[key] = [];
        newGrid[key].push(point);
      });
      
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

    const createConnections = (points: any[]) => {
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
            
            if (baseAlpha > 0.05) {
              connections.push({
                p1: point,
                p2: other,
                density,
                baseAlpha,
                hue: (point.hue + other.hue) / 2,
                lineWidth: Math.min(2.5 * density, 2.5),
              });
            }
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
          
          const curveAngle = angle + Math.sin(t * Math.PI) * 0.3;
          const x = startX + getCos(curveAngle) * t * length;
          const y = startY - getSin(curveAngle) * t * length;

          branchPoints.push({
            x, y,
            density: Math.max(0.3, density * (1 - t * 0.4)),
            hue: 200 + Math.random() * 160,
            level,
            index: pointIndex++
          });
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

      // Create main trunk
      addBranch(baseX, baseY, Math.PI / 2, height * 0.4, 20, 1.4, 0);

      // Create main branches
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
      updateSpatialGrid(points);
      createConnections(points);
    };

    const drawTree = () => {
      // Clear canvas with solid black background
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
      
      // Set blend mode for glowing effect
      ctx.globalCompositeOperation = 'lighter';
      
      // Draw all connections
      state.connections.forEach(conn => {
        const color = conn.density > 0.7 
          ? `rgba(255,255,255,${conn.baseAlpha * 0.9})`
          : `hsla(${conn.hue},75%,70%,${conn.baseAlpha * 0.7})`;
        
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = conn.lineWidth;
        ctx.moveTo(conn.p1.x, conn.p1.y);
        ctx.lineTo(conn.p2.x, conn.p2.y);
        ctx.stroke();
      });
      
      // Reset composite operation
      ctx.globalCompositeOperation = 'source-over';
    };

    // Initial setup
    updateSize();
    
    // Handle window resize
    window.addEventListener('resize', updateSize);
    
    return () => {
      window.removeEventListener('resize', updateSize);
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

export default StaticIridescentTree;