import React, { useEffect, useRef } from 'react';

const GrowingIridescentTree = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    points: [] as any[],
    staticPoints: [] as any[],
    ctx: null as CanvasRenderingContext2D | null,
    canvasWidth: 0,
    canvasHeight: 0,
    animationFrame: 0,
    MIN_DISTANCE: 5,
    MAX_DISTANCE: 30,
    activePointIndices: new Set<number>(),
    POINTS_PER_GROWTH: 3,
    GROWTH_INTERVAL: 50,
    lastGrowthTime: 0,
    branchPoints: [] as any[],
    maxBranches: 30,
    mouseX: 0,
    mouseY: 0,
    repelMode: false // <-- Added state for repel mode
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;
    state.ctx = ctx;

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

      resetTrees();
    };

    const initializeTree = (startX: number, baseAngle: number) => {
      state.branchPoints.push({
        startX,
        startY: state.canvasHeight * 0.95,
        baseAngle,
        angle: baseAngle,
        length: state.canvasHeight * 0.4,
        width: 55,
        progress: 0,
        parentIndex: -1,
        level: 0,
        treeIndex: state.branchPoints.length
      });
    };

    const resetTrees = () => {
      state.points = [];
      state.staticPoints = [];
      state.activePointIndices.clear();
      state.branchPoints = [];

      // Initialize three trees at different positions
      const width = state.canvasWidth;
      initializeTree(width * 0.2, Math.PI / 2); // Left tree
      initializeTree(width * 0.5, Math.PI / 2); // Middle tree
      initializeTree(width * 0.8, Math.PI / 2); // Right tree
    };

    const generateNewBranch = (parentBranch: any, parentProgress: number) => {
      const spreadFactor = 1.8 + (parentBranch.level * 0.8);
      const baseSpread = (Math.random() * spreadFactor - spreadFactor / 2);

      const startX = parentBranch.startX + Math.cos(parentBranch.angle) * (parentBranch.length * parentProgress);
      const startY = parentBranch.startY - Math.sin(parentBranch.angle) * (parentBranch.length * parentProgress);

      return {
        startX,
        startY,
        baseAngle: parentBranch.baseAngle + baseSpread,
        angle: parentBranch.angle,
        length: parentBranch.length * (0.6 + Math.random() * 0.3),
        width: parentBranch.width * 0.8,
        progress: 0,
        parentIndex: state.branchPoints.indexOf(parentBranch),
        level: parentBranch.level + 1,
        treeIndex: parentBranch.treeIndex
      };
    };

    const updateDirections = () => {
      // Update all branch angles towards or away from the mouse position
      const { mouseX, mouseY, repelMode } = state;
      state.branchPoints.forEach(branch => {
        const dx = mouseX - branch.startX;
        const dy = branch.startY - mouseY;
        let angleToMouse = Math.atan2(dy, dx);

        // If in repel mode, flip the angle by π (180 degrees)
        if (repelMode) {
          angleToMouse += Math.PI;
        }

        branch.angle = angleToMouse;
      });
    };

    const growBranches = (timestamp: number) => {
      if (timestamp - state.lastGrowthTime > state.GROWTH_INTERVAL) {
        state.lastGrowthTime = timestamp;

        // Update existing branches
        state.branchPoints.forEach((branch, index) => {
          if (branch.progress < 1) {
            branch.progress += 0.02;

            // Spawn new branches occasionally
            if (branch.level < 4 && branch.progress > 0.3 && Math.random() < 0.1) {
              const branchesInTree = state.branchPoints.filter(b => b.treeIndex === branch.treeIndex).length;
              if (branchesInTree < state.maxBranches / 3) {
                const newBranch = generateNewBranch(branch, branch.progress);
                state.branchPoints.push(newBranch);
              }
            }
          }
        });

        // Generate points for all active branches
        let pointIndex = state.points.length;
        const newPoints = [];

        state.branchPoints.forEach(branch => {
          if (branch.progress < 1) {
            const x = branch.startX + Math.cos(branch.angle) * (branch.length * branch.progress);
            const y = branch.startY - Math.sin(branch.angle) * (branch.length * branch.progress);

            const point = {
              x,
              y,
              originalX: x,
              originalY: y,
              density: Math.max(0.3, 1 - branch.progress * 0.5),
              hue: 200 + Math.random() * 160,
              index: pointIndex++,
              phase: Math.random() * Math.PI * 2,
              waveMagnitude: 2 + Math.random() * 2,
              movementScale: 2 + Math.random() * 2,
              branchLevel: branch.level,
              treeIndex: branch.treeIndex
            };

            newPoints.push(point);
            state.activePointIndices.add(point.index);
          }
        });

        if (newPoints.length > 0) {
          state.points.push(...newPoints);
          state.staticPoints.push(...newPoints.map(p => ({ ...p })));
        }
      }
    };

    const updatePoints = (time: number) => {
      const points = state.points;
      const staticPoints = state.staticPoints;
      const activeIndices = state.activePointIndices;

      points.forEach((point, i) => {
        if (activeIndices.has(point.index)) {
          const basePoint = staticPoints[i];
          const t = time + point.phase;
          const waveScale = Math.max(0.2, 1 - point.branchLevel * 0.2);

          point.x = basePoint.originalX + Math.sin(t * 2) * point.waveMagnitude * waveScale;
          point.y = basePoint.originalY + Math.cos(t * 2) * point.movementScale * waveScale;
        }
      });

      // Gradually settle points
      if (time % 5 < 0.1) {
        activeIndices.forEach(index => {
          if (Math.random() < 0.05) {
            activeIndices.delete(index);
          }
        });
      }
    };

    const drawConnections = () => {
      const ctx = state.ctx!;
      const points = state.points;

      points.forEach((point, i) => {
        for (let j = i + 1; j < points.length; j++) {
          const other = points[j];
          if (point.treeIndex === other.treeIndex) {
            const dx = other.x - point.x;
            const dy = other.y - point.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < state.MAX_DISTANCE) {
              const alpha = (1 - dist / state.MAX_DISTANCE) * 0.4;
              const density = (point.density + other.density) / 2;

              ctx.beginPath();
              ctx.strokeStyle = density > 0.85
                ? `rgba(255, 255, 255, ${alpha * 0.6})`
                : `hsla(${(point.hue + other.hue) / 2}, 80%, 75%, ${alpha * 0.8})`;
              ctx.lineWidth = Math.min(2.2 * density, 2.2) * (1 - dist / state.MAX_DISTANCE);
              ctx.moveTo(point.x, point.y);
              ctx.lineTo(other.x, other.y);
              ctx.stroke();
            }
          }
        }
      });
    };

    const animate = (timestamp: number) => {
      const ctx = state.ctx!;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);

      updateDirections();
      growBranches(timestamp);
      updatePoints(timestamp * 0.001);
      drawConnections();

      state.animationFrame = requestAnimationFrame(animate);
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      state.mouseX = e.clientX - rect.left;
      state.mouseY = e.clientY - rect.top;
    };

    const onClick = () => {
      state.repelMode = !state.repelMode;
    };

    updateSize();
    state.animationFrame = requestAnimationFrame(animate);
    window.addEventListener('resize', updateSize);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
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
