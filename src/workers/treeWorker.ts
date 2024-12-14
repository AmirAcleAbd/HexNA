// TreeWorker.ts
type Point = {
    x: number;
    y: number;
    originalX: number;
    originalY: number;
    waveMagnitude: number;
    density: number;
    hue: number;
    level: number;
    phase: number;
    index: number;
    movementScale: number;
  };
  
  type WorkerState = {
    points: Point[];
    staticPoints: Point[];
    cosCache: Float32Array;
    sinCache: Float32Array;
  };
  
  let state: WorkerState = {
    points: [],
    staticPoints: [],
    cosCache: new Float32Array(360),
    sinCache: new Float32Array(360),
  };
  
  // Pre-calculate trigonometric values
  for (let i = 0; i < 360; i++) {
    const rad = (i * Math.PI) / 180;
    state.cosCache[i] = Math.cos(rad);
    state.sinCache[i] = Math.sin(rad);
  }
  
  const getCos = (angle: number) => state.cosCache[Math.floor((angle * 180) / Math.PI) % 360];
  const getSin = (angle: number) => state.sinCache[Math.floor((angle * 180) / Math.PI) % 360];
  
  function createTreeStructure(width: number, height: number) {
    const points: Point[] = [];
    const baseX = width / 2;
    const baseY = height * 0.95;
    let pointIndex = 0;
  
    function addBranch(
      startX: number,
      startY: number,
      angle: number,
      length: number,
      width: number,
      density = 1,
      level = 0
    ) {
      const pointCount = Math.floor(length / 8) * density;
      const branchPoints: Point[] = [];
      
      for (let i = 0; i < pointCount; i++) {
        const t = i / pointCount;
        const spread = Math.sin(t * Math.PI) * width * (1 - t * 0.7);
        const waveMagnitude = width * 0.15 * (1 - t);
        
        const curveAngle = angle + Math.sin(t * Math.PI) * 0.3;
        const x = startX + getCos(curveAngle) * t * length;
        const y = startY - getSin(curveAngle) * t * length;
  
        branchPoints.push({
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
    }
  
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
    state.staticPoints = points.map(p => ({ ...p }));
    
    return { points, staticPoints: state.staticPoints };
  }
  
  function updatePoints(time: number) {
    const points = state.points;
    const staticPoints = state.staticPoints;
    const len = points.length;
    const updates = new Float32Array(len * 2);
    
    for (let i = 0; i < len; i++) {
      const point = points[i];
      const basePoint = staticPoints[i];
      const t = time + point.phase;
      
      updates[i * 2] = basePoint.originalX + Math.sin(time + t * 5) * point.waveMagnitude;
      updates[i * 2 + 1] = basePoint.originalY + point.movementScale * Math.cos(t * 3);
    }
    
    return updates;
  }
  
  self.onmessage = (e: MessageEvent) => {
    const { type, data } = e.data;
    
    switch (type) {
      case 'init':
        const { width, height } = data;
        const treeData = createTreeStructure(width, height);
        self.postMessage({ type: 'init', data: treeData });
        break;
        
      case 'update':
        const updates = updatePoints(data.time);
        self.postMessage({ type: 'update', data: updates }, [updates.buffer]);
        break;
    }
  };