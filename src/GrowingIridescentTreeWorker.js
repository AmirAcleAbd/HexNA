let state = {
    points: [],
    staticPoints: [],
    MIN_DISTANCE: 5,
    MAX_DISTANCE: 33,
    activePointIndices: new Set(),
    POINTS_PER_GROWTH: 3,
    GROWTH_INTERVAL: 50,
    lastGrowthTime: 0,
    branchPoints: [],
    lastDirectionChange: 0,
    DIRECTION_CHANGE_INTERVAL: 1200,
    baseAngleOffset: 0,
    targetAngleOffset: 0,
    angleTransitionStart: 0,
    ANGLE_TRANSITION_DURATION: 800,
    canvasWidth: 0,
    canvasHeight: 0,
    lastTimestamp: 0,
  
    // Store birthOrders of points in FIFO order
    pointQueue: [],
  
    lastTreeSpawnTime: 0,
    TREE_SPAWN_INTERVAL: 3600,
    globalPointCounter: 0,
  
    treeInfo: [], // {rootX, rootY, angle, active: bool}
    activeTreeIndex: 0,
  
    // Only start culling old points once we have spawned a new tree after the initial one
    enableCulling: true,
  
    // Track if we did at least one finalizeRemovals to keep order stable
  };
  
  self.onmessage = (e) => {
    const data = e.data;
    switch (data.type) {
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
        const now = data.timestamp;
        updateDirections(now);
        checkTreeSpawn(now);
        growBranches(now);
        updatePoints(now * 0.001);
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
    state.treeInfo = [];
    state.pointQueue = [];
    state.globalPointCounter = 0;
    state.enableCulling = false;
  
    state.lastTreeSpawnTime = performance.now();
  
    // Initialize a single active tree in the center bottom
    initializeTree(
      state.canvasWidth * 0.5,
      state.canvasHeight * 0.95,
      Math.PI / 2,
      true
    );
  
    // Another inactive tree at top for variety
    initializeTree(
      state.canvasWidth * 0.5,
      state.canvasHeight * 0.05,
      Math.PI * 1.5,
      true
    );
  
    state.activeTreeIndex = 0;
  }
  
  function initializeTree(startX, startY, baseAngle, isActive) {
    //add logic to spawn the tree back in center if outside
    baseAngle = ensureAngleInView(startX, startY, baseAngle);
  
    const treeIndex = state.treeInfo.length;
    state.treeInfo.push({
      rootX: startX,
      rootY: startY,
      angle: baseAngle,
      active: isActive
    });
  
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
      treeIndex: treeIndex
    });
  }
  
  function ensureAngleInView(x, y, angle) {
    const testDist = 200;
    const testX = x + Math.cos(angle) * testDist;
    const testY = y - Math.sin(angle) * testDist;
    if (testX < 0 || testX > state.canvasWidth || testY < 0 || testY > state.canvasHeight) {
      // Turn ±135 degrees
      const turn = (Math.random() < 0.5 ? 1 : -1) * (135 * Math.PI / 180);
      angle += turn;
    }
    return angle;
  }
  
  function checkTreeSpawn(timestamp) {
    if (timestamp - state.lastTreeSpawnTime > state.TREE_SPAWN_INTERVAL && state.points.length > 0) {
      // Spawn a new tree from a random point
      const randomPoint = state.points[Math.floor(Math.random() * state.points.length)];
      const angle = findAngleForNewTree(randomPoint.x, randomPoint.y);
  
      // Current active tree becomes inactive
      if (state.treeInfo[state.activeTreeIndex]) {
        state.treeInfo[state.activeTreeIndex].active = false;
      }
  
      // Initialize new tree
      initializeTree(randomPoint.x, randomPoint.y, angle, true);
      state.activeTreeIndex = state.treeInfo.length - 1;
  
      // After first new tree spawn, enable culling
      state.enableCulling = true;
  
      state.lastTreeSpawnTime = timestamp;
    }
  }
  
  function findAngleForNewTree(x, y) {
    let closestBranch = null;
    let closestDist = Infinity;
    for (let b of state.branchPoints) {
      const dx = b.startX - x;
      const dy = b.startY - y;
      const dist = dx*dx + dy*dy;
      if (dist < closestDist) {
        closestDist = dist;
        closestBranch = b;
      }
    }
    let angle = closestBranch ? closestBranch.angle : Math.PI/2;
    angle = ensureAngleInView(x, y, angle);
    return angle;
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
      state.targetAngleOffset = (Math.random() * 1.2 - 0.6);
      state.angleTransitionStart = timestamp;
    }
    const currentOffset = getCurrentAngleOffset();
    state.branchPoints.forEach(branch => {
      branch.angle = branch.baseAngle + currentOffset;
      branch.angle = ensureAngleInView(branch.startX, branch.startY, branch.angle);
    });
  }
  
  function growBranches(timestamp) {
    if (timestamp - state.lastGrowthTime > state.GROWTH_INTERVAL) {
      state.lastGrowthTime = timestamp;
  
      // Grow active trees only
      state.branchPoints.forEach((branch) => {
        if (!state.treeInfo[branch.treeIndex].active) return;
        if (branch.progress < 1) {
          branch.progress += 0.02;
          if (branch.level < 4 && branch.progress > 0.3 && Math.random() < 0.1) {
            const newBranch = generateNewBranch(branch, branch.progress);
            state.branchPoints.push(newBranch);
          }
        }
      });
  
      let pointIndex = state.points.length;
      const newPoints = [];
      state.branchPoints.forEach(branch => {
        if (!state.treeInfo[branch.treeIndex].active) return;
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
            treeIndex: branch.treeIndex,
            birthOrder: state.globalPointCounter++
          };
          newPoints.push(point);
          state.activePointIndices.add(point.index);
        }
      });
  
      if (newPoints.length > 0) {
        state.points.push(...newPoints);
        state.staticPoints.push(...newPoints.map(p => ({ ...p })));
        // Add their birthOrders to the queue
        for (let p of newPoints) {
          state.pointQueue.push(p.birthOrder);
        }
  
        // If culling is enabled, remove one old point per new point
        if (state.enableCulling) {
          for (let i = 0; i < newPoints.length; i++) {
            if (state.pointQueue.length > 0) {
              const oldestBirth = state.pointQueue.shift(); // oldest point birthOrder
              removeOldestPointByBirthOrder(oldestBirth);
            }
          }
          finalizeRemovals();
        }
      }
    }
  }
  
  function generateNewBranch(parentBranch, parentProgress) {
    const spreadFactor = 1.8 + (parentBranch.level * 0.8);
    const baseSpread = (Math.random() * spreadFactor - spreadFactor/2);
    const currentAngleOffset = getCurrentAngleOffset();
    let angle = parentBranch.baseAngle + baseSpread + currentAngleOffset;
    const startX = parentBranch.startX + Math.cos(parentBranch.angle) * (parentBranch.length * parentProgress);
    const startY = parentBranch.startY - Math.sin(parentBranch.angle) * (parentBranch.length * parentProgress);
    angle = ensureAngleInView(startX, startY, angle);
    return {
      startX,
      startY,
      baseAngle: parentBranch.baseAngle + baseSpread,
      angle,
      length: parentBranch.length * (0.6 + Math.random() * 0.3),
      width: parentBranch.width * 1,
      progress: 0,
      parentIndex: state.branchPoints.indexOf(parentBranch),
      level: parentBranch.level + 1,
      treeIndex: parentBranch.treeIndex
    };
  }
  
  let removalSet = new Set();
  function removeOldestPointByBirthOrder(birthOrder) {
    // Find the point with this birthOrder
    // state.points are in increasing birthOrder because we add at the end and only remove oldest points
    // but to be safe, we will sort by birthOrder in finalizeRemovals.
    // For now, just find it linearly:
    for (let p of state.points) {
      if (p.birthOrder === birthOrder) {
        removalSet.add(p.index);
        break;
      }
    }
  }
  
  function finalizeRemovals() {
    if (removalSet.size === 0) return;
  
    // Remove selected points
    state.points = state.points.filter(p => !removalSet.has(p.index));
    state.staticPoints = state.staticPoints.filter((sp, i) => !removalSet.has(sp.index));
    for (let rm of removalSet) {
      state.activePointIndices.delete(rm);
    }
  
    // Resort points by birthOrder to keep them in ascending order
    state.points.sort((a, b) => a.birthOrder - b.birthOrder);
    for (let i = 0; i < state.points.length; i++) {
      const p = state.points[i];
      p.index = i;
      state.staticPoints[i] = { ...state.staticPoints[i], index: i };
    }
  
    // Rebuild active indices
    const newActive = new Set();
    for (let p of state.points) {
      if (state.activePointIndices.has(p.index)) {
        newActive.add(p.index);
      } else {
        newActive.add(p.index);
      }
    }
    state.activePointIndices = newActive;
  
    // Rebuild queue from the sorted points
    // The queue should represent points in order of their birthOrder (oldest first)
    // Since we sorted by birthOrder, we can just map:
    state.pointQueue = state.points.map(p => p.birthOrder);
  
    removalSet.clear();
  }
  
  function updatePoints(time) {
    for (let idx of state.activePointIndices) {
      if (idx >= state.points.length) continue;
      const point = state.points[idx];
      const basePoint = state.staticPoints[idx];
      const t = time + point.phase;
      const waveScale = Math.max(0.2, 1 - point.branchLevel * 0.2);
      point.x = basePoint.originalX + Math.sin(t * 2) * point.waveMagnitude * waveScale;
      point.y = basePoint.originalY + Math.cos(t * 2) * point.movementScale * waveScale;
    }
  
    // Gradually settle some points
    if (time % 5 < 0.1) {
      for (let index of state.activePointIndices) {
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
  