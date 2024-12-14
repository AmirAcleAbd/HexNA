import React, { useEffect, useRef } from 'react';
import Worker from './GrowingIridescentTreeWorker.js?worker';

const GrowingTree = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const animationRef = useRef<number>(0);

  const renderStateRef = useRef({
    ctx: null as CanvasRenderingContext2D | null,
    canvasWidth: 0,
    canvasHeight: 0,
    points: [] as any[],
    MAX_DISTANCE: 30
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    renderStateRef.current.ctx = ctx;

    const updateSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      renderStateRef.current.canvasWidth = width;
      renderStateRef.current.canvasHeight = height;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'resize', width, height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    const worker = new Worker();
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { data } = e;
      if (data.type === 'draw') {
        renderStateRef.current.points = data.points;
        renderStateRef.current.MAX_DISTANCE = data.MAX_DISTANCE;
        drawFrame(data.points, data.lines, data.MAX_DISTANCE);
      }
    };

    worker.postMessage({ type: 'init', width: renderStateRef.current.canvasWidth, height: renderStateRef.current.canvasHeight });

    const animate = (timestamp: number) => {
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'update', timestamp });
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', updateSize);
      cancelAnimationFrame(animationRef.current);
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const drawFrame = (points: any[], lines: any[], MAX_DISTANCE: number) => {
    const { ctx, canvasWidth, canvasHeight } = renderStateRef.current;
    if (!ctx) return;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // If we have a huge number of lines, let's cap them
    const MAX_LINES_DRAWN = 5000;
    if (lines.length > MAX_LINES_DRAWN) {
      // Shuffle lines or just slice a subset to draw
      // Simple approach: slice the first MAX_LINES_DRAWN lines
      lines = lines.slice(0, MAX_LINES_DRAWN);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const pointA = points[line.pIndex];
      const pointB = points[line.qIndex];

      const dx = pointB.x - pointA.x;
      const dy = pointB.y - pointA.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < MAX_DISTANCE) {
        const alpha = (1 - dist / MAX_DISTANCE) * 0.4;
        const density = (pointA.density + pointB.density) / 2;

        ctx.beginPath();
        ctx.moveTo(pointA.x, pointA.y);
        ctx.lineTo(pointB.x, pointB.y);
        ctx.strokeStyle = density > 0.85
          ? `rgba(255, 255, 255, ${alpha * 0.6})`
          : `hsla(${(pointA.hue + pointB.hue) / 2}, 80%, 75%, ${alpha * 0.8})`;
        ctx.lineWidth = Math.min(2.2 * density, 2.2) * (1 - dist / MAX_DISTANCE);
        ctx.stroke();
      }
    }
  };

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden">
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
};

export default GrowingTree;

