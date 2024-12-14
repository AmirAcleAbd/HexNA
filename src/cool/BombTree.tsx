import React, { useEffect, useRef } from 'react';

const GrowingIridescentTree = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    points: [],
    staticPoints: [],
    ctx: null as CanvasRenderingContext2D | null,
    canvasWidth: 0,
    canvasHeight: 0,
    lastFrame: 0,
    animationFrame: 0,
    MIN_DISTANCE: 5,
    MAX_DISTANCE: 40,
    activePointIndices: new Set<number>(),
    startTime: 0,
    mainPoints: [] as any[],
    POINT_ANIMATION_DURATION: 4000, // 4 seconds animation
    nextPointId: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;
    state.ctx = ctx;
    state.startTime = Date.now();

    const updateSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      ctx.scale(dpr, dpr);
      state.canvasWidth = width;
      state.canvasHeight = height;
      
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      
      initializeMainPoints();
    };

    const createPoint = (x: number, y: number, parent: any = null) => {
      const id = state.nextPointId++;
      return {
        id,
        x,
        y,
        originalX: x,
        originalY: y,
        velocityX: 0,
        velocityY: 0,
        targetX: x,
        targetY: y,
        hue: 200 + Math.random() * 160,
        createdAt: Date.now(),
        parent,
        children: [],
        phase: Math.random() * Math.PI * 2,
        waveMagnitude: 2 + Math.random() * 2,
        density: parent ? 0.7 : 1
      };
    };

    const initializeMainPoints = () => {
      const startX = state.canvasWidth * 0.8;
      const startY = state.canvasHeight * 0.95;
      
      // Create 5 main points
      for (let i = 0; i < 5; i++) {
        const point = createPoint(startX, startY);
        // Initial direction: mostly upward with slight randomness
        point.velocityX = (Math.random() - 0.5) * 2;
        point.velocityY = -3 - Math.random() * 2;
        state.mainPoints.push(point);
        state.points.push(point);
        state.staticPoints.push({...point});
        state.activePointIndices.add(point.id);
      }
    };

    const createBranch = (parent: any, angleOffset: number) => {
      const angle = Math.atan2(-parent.velocityY, parent.velocityX) + angleOffset;
      const speed = 4;
      const velocityX = Math.cos(angle) * speed;
      const velocityY = Math.sin(angle) * speed;
      
      const point = createPoint(parent.x, parent.y, parent);
      point.velocityX = velocityX;
      point.velocityY = -Math.abs(velocityY); // Ensure upward movement
      
      parent.children.push(point);
      state.points.push(point);
      state.staticPoints.push({...point});
      state.activePointIndices.add(point.id);
      
      return point;
    };

    const updatePoints = (time: number) => {
      const elapsedTime = Date.now() - state.startTime;
      const points = state.points;
      const activeIndices = state.activePointIndices;

      // Update main points initial movement
      if (elapsedTime < 3000) {
        state.mainPoints.forEach(point => {
          point.x += point.velocityX;
          point.y += point.velocityY;
          point.originalX = point.x;
          point.originalY = point.y;
        });
      }
      
      // First branching at 3 seconds
      else if (elapsedTime >= 3000 && elapsedTime < 3100 && state.mainPoints[0].children.length === 0) {
        state.mainPoints.forEach(point => {
          // Create 3 branches per main point
          for (let i = 0; i < 3; i++) {
            const angleOffset = (i - 1) * Math.PI / 3;
            createBranch(point, angleOffset);
          }
        });
      }
      
      // Second branching at 6 seconds
      else if (elapsedTime >= 6000 && elapsedTime < 6100) {
        state.mainPoints.forEach(point => {
          point.children.forEach(child => {
            if (child.children.length === 0) {
              // Random number of branches (2-4)
              const branchCount = 2 + Math.floor(Math.random() * 3);
              for (let i = 0; i < branchCount; i++) {
                const angleOffset = (i - (branchCount-1)/2) * Math.PI / 3;
                createBranch(child, angleOffset);
              }
            }
          });
        });
      }
      
      // Random child generation after 6 seconds
      else if (elapsedTime >= 6000) {
        state.points.forEach(point => {
          if (Math.random() < 0.001) { // Chance to create new branch
            const angleOffset = (Math.random() - 0.5) * Math.PI;
            createBranch(point, angleOffset);
          }
        });
      }

      // Update all points position and animation
      points.forEach((point, i) => {
        if (!point.parent) return; // Skip main points after initial movement
        
        // Update position based on velocity
        point.x += point.velocityX * 0.5;
        point.y += point.velocityY * 0.5;
        point.originalX = point.x;
        point.originalY = point.y;

        // Animate points
        if (activeIndices.has(point.id)) {
          const pointAge = Date.now() - point.createdAt;
          if (pointAge < state.POINT_ANIMATION_DURATION) {
            const t = time + point.phase;
            point.x = point.originalX + Math.sin(t * 2) * point.waveMagnitude;
            point.y = point.originalY + Math.cos(t * 2) * point.waveMagnitude;
          } else {
            activeIndices.delete(point.id);
          }
        }
      });
    };

    const drawConnections = () => {
      const ctx = state.ctx!;
      const points = state.points;

      ctx.globalCompositeOperation = 'lighter';
      
      points.forEach((point, i) => {
        points.slice(i + 1).forEach(other => {
          const dx = other.x - point.x;
          const dy = other.y - point.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < state.MAX_DISTANCE) {
            const alpha = (1 - dist / state.MAX_DISTANCE) * 0.4;
            
            ctx.beginPath();
            ctx.strokeStyle = point.density > 0.85
              ? `rgba(255, 255, 255, ${alpha * 0.6})`
              : `hsla(${(point.hue + other.hue) / 2}, 80%, 75%, ${alpha * 0.8})`;
            ctx.lineWidth = Math.min(2 * point.density, 2) * (1 - dist / state.MAX_DISTANCE);
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        });
      });
      
      ctx.globalCompositeOperation = 'source-over';
    };

    const animate = (timestamp: number) => {
      const ctx = state.ctx!;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);

      updatePoints(timestamp * 0.001);
      drawConnections();

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

export default GrowingIridescentTree;