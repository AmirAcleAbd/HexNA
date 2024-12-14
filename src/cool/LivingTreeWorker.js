let state = {
    points: [],
    staticPoints: [],
    MIN_DISTANCE: 5,
    MAX_DISTANCE: 30,
    activePointIndices: new Set(),
    POINTS_PER_GROWTH: 3,
    GROWTH_INTERVAL: 100,
    lastGrowthTime: 0,
    branchPoints: [],
    maxBranches: 50,
    lastDirectionChange: 0,
    DIRECTION_CHANGE_INTERVAL: 1500,
    baseAngleOffset: 0,
    targetAngleOffset: 0,
    angleTransitionStart: 0,
    ANGLE_TRANSITION_DURATION: 1000,
    canvasWidth: 0,
    canvasHeight: 0,
    lastTimestamp: 0,
    updateStartIndex: 0, // for round-robin updates
    ANIMATION_FRACTION: 0.5, // Only animate 30% of active points each frame
  };
  
  self.onmessage = (e) => {
    const data = e.data;
    switch(data.type) {
      case 'init':
        state.canvasWidth = data.width;
        state.canvasHeight = data.height;
        resetTrees();
        break;
      case 'resize':
        state.canvasWidth = data.width;
        state.canvasHeight = data.height;
        resetTrees();
        break;
      case 'update':
        updateDirections(data.timestamp);
        growBranches(data.timestamp);
        updatePoints(data.timestamp * 0.001);
        const { lines } = generateConnections();
        self.postMessage({ type: 'draw', points: state.points, lines, MAX_DISTANCE: state.MAX_DISTANCE });
        break;
    }
  };
  
  function resetTrees() {
    state.points = [];
    state.staticPoints = [];
    state.activePointIndices.clear();
    state.branchPoints = [];
    state.baseAngleOffset = 0;
    state.targetAngleOffset = 0;
  
    initializeTree(
      state.canvasWidth * (Math.random() * 0.2 + 0.4),
      state.canvasHeight * 0.95,
      Math.PI / 2
    );
    initializeTree(
      state.canvasWidth * (Math.random() * 0.2 + 0.4),
      state.canvasHeight * 0.05,
      Math.PI * 1.5
    );
  }
  
  function initializeTree(startX, startY, baseAngle) {
    state.branchPoints.push({
      startX,
      startY,
      baseAngle,
      angle: baseAngle,
      length: state.canvasHeight * 0.4,
      width: 55,
      progress: 0,
      parentIndex: -1,
      level: 0,
      treeIndex: state.branchPoints.length
    });
  }
  
  function generateNewBranch(parentBranch, parentProgress) {
    const spreadFactor = 1.8 + (parentBranch.level * 0.8);
    const baseSpread = (Math.random() * spreadFactor - spreadFactor/2);
    const currentAngleOffset = getCurrentAngleOffset();
    const angle = parentBranch.baseAngle + baseSpread + currentAngleOffset;
    const startX = parentBranch.startX + Math.cos(parentBranch.angle) * (parentBranch.length * parentProgress);
    const startY = parentBranch.startY - Math.sin(parentBranch.angle) * (parentBranch.length * parentProgress);
    return {
      startX,
      startY,
      baseAngle: parentBranch.baseAngle + baseSpread,
      angle,
      length: parentBranch.length * (0.6 + Math.random() * 0.3),
      width: parentBranch.width * 0.8,
      progress: 0,
      parentIndex: state.branchPoints.indexOf(parentBranch),
      level: parentBranch.level + 1,
      treeIndex: parentBranch.treeIndex
    };
  }
  
  function getCurrentAngleOffset() {
    const now = performance.now();
    const transitionProgress = Math.min(
      (now - state.angleTransitionStart) / state.ANGLE_TRANSITION_DURATION,
      1
    );
    return state.baseAngleOffset + (state.targetAngleOffset - state.baseAngleOffset) * transitionProgress;
  }
  
  function updateDirections(timestamp) {
    if (timestamp - state.lastDirectionChange > state.DIRECTION_CHANGE_INTERVAL) {
      state.lastDirectionChange = timestamp;
      state.baseAngleOffset = state.targetAngleOffset;
      state.targetAngleOffset = (Math.random() * 2.0 - 1.0);
      state.angleTransitionStart = timestamp;
    }
    const currentOffset = getCurrentAngleOffset();
    state.branchPoints.forEach(branch => {
      branch.angle = branch.baseAngle + currentOffset;
    });
  }
  
  function growBranches(timestamp) {
    if (timestamp - state.lastGrowthTime > state.GROWTH_INTERVAL) {
      state.lastGrowthTime = timestamp;
      state.branchPoints.forEach((branch) => {
        if (branch.progress < 1) {
          branch.progress += 0.02;
          if (branch.level < 4 && branch.progress > 0.3 && Math.random() < 0.1) {
            const branchesInTree = state.branchPoints.filter(b => b.treeIndex === branch.treeIndex).length;
            if (branchesInTree < state.maxBranches / 3) {
              const newBranch = generateNewBranch(branch, branch.progress);
              state.branchPoints.push(newBranch);
            }
          }
        }
      });
  
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
  }
  
  function updatePoints(time) {
    const points = state.points;
    const staticPoints = state.staticPoints;
    const activeIndices = Array.from(state.activePointIndices);
  
    // Determine how many points to update this frame
    const toAnimateCount = Math.floor(activeIndices.length * state.ANIMATION_FRACTION);
    if (toAnimateCount < 1) return;
  
    // Round-robin: start from state.updateStartIndex
    const start = state.updateStartIndex;
    const end = start + toAnimateCount;
    
    for (let i = start; i < end; i++) {
      const idx = activeIndices[i % activeIndices.length];
      const point = points[idx];
      const basePoint = staticPoints[idx];
  
      const t = time + point.phase;
      const waveScale = Math.max(0.2, 1 - point.branchLevel * 0.2);
      point.x = basePoint.originalX + Math.sin(t * 2) * point.waveMagnitude * waveScale;
      point.y = basePoint.originalY + Math.cos(t * 2) * point.movementScale * waveScale;
    }
  
    state.updateStartIndex = (end % activeIndices.length);
  
    // Gradually settle points
    if (time % 5 < 0.1) {
      for (let index of activeIndices) {
        if (Math.random() < 0.05) {
          state.activePointIndices.delete(index);
        }
      }
    }
  }
  
  function generateConnections() {
    const points = state.points;
    const lines = [];
    if (points.length === 0) return { lines };
  
    const cellSize = state.MAX_DISTANCE;
    const grid = new Map();
  
    function cellKey(cx, cy) {
      return `${cx},${cy}`;
    }
  
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      // Skip points off-screen to reduce line computations
      if (p.x < 0 || p.x > state.canvasWidth || p.y < 0 || p.y > state.canvasHeight) {
        continue;
      }
      const cx = Math.floor(p.x / cellSize);
      const cy = Math.floor(p.y / cellSize);
      const key = cellKey(cx, cy);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    }
  
    const neighbors = [-1, 0, 1];
    for (let [key, cellIndices] of grid) {
      const [cx, cy] = key.split(',').map(Number);
      const candidateIndices = [];
      for (let nx of neighbors) {
        for (let ny of neighbors) {
          const nKey = cellKey(cx + nx, cy + ny);
          if (grid.has(nKey)) {
            candidateIndices.push(...grid.get(nKey));
          }
        }
      }
  
      // Check connections within the cell
      for (let i = 0; i < cellIndices.length; i++) {
        const pIndex = cellIndices[i];
        const p = points[pIndex];
        for (let j = i + 1; j < cellIndices.length; j++) {
          const qIndex = cellIndices[j];
          const q = points[qIndex];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < state.MAX_DISTANCE * state.MAX_DISTANCE) {
            lines.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y, pIndex, qIndex });
          }
        }
  
        // Check candidate points
        for (let qIndex of candidateIndices) {
          if (qIndex <= pIndex) continue; 
          const q = points[qIndex];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < state.MAX_DISTANCE * state.MAX_DISTANCE) {
            lines.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y, pIndex, qIndex });
          }
        }
      }
    }
  
    return { lines };
  }
  