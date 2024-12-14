let canvas: OffscreenCanvas;
let ctx: OffscreenCanvasRenderingContext2D;

// Rendering state
const state = {
  positions: new Float32Array(0),
  properties: new Float32Array(0),
  connections: new Uint32Array(0),
  width: 0,
  height: 0,
  time: 0,
  frameCount: 0,
  lastFrame: 0
};

function updatePoints(timestamp: number) {
  const time = timestamp * 0.001;
  const len = state.positions.length / 2;
  
  for (let i = 0; i < len; i++) {
    const idx = i * 2;
    const propIdx = i * 4;
    
    const phase = state.properties[propIdx + 2];
    const waveMag = state.properties[propIdx + 3];
    const t = time + phase;
    
    // Update positions with animation
    const movement = Math.sin(t * 2) * (1 - state.properties[propIdx]) * 2.5;
    state.positions[idx] += Math.sin(time + t * 5) * waveMag;
    state.positions[idx + 1] += movement * Math.cos(t * 3);
  }
}

function render(timestamp: number) {
  const elapsed = timestamp - state.lastFrame;
  
  if (elapsed > 16) { // Cap at ~60fps
    state.lastFrame = timestamp;
    state.frameCount++;
    
    // Clear with trail effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, state.width, state.height);
    
    // Update point positions
    updatePoints(timestamp);
    
    // Batch render connections
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    
    const path = new Path2D();
    const len = state.connections.length / 2;
    
    for (let i = 0; i < len; i++) {
      const connIdx = i * 2;
      const p1Idx = state.connections[connIdx] * 2;
      const p2Idx = state.connections[connIdx + 1] * 2;
      
      const p1PropIdx = state.connections[connIdx] * 4;
      const p2PropIdx = state.connections[connIdx + 1] * 4;
      
      const density = (state.properties[p1PropIdx] + state.properties[p2PropIdx]) / 2;
      const hue = (state.properties[p1PropIdx + 1] + state.properties[p2PropIdx + 1]) / 2;
      
      // Set style based on density
      if (density > 0.7) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${density * 0.9})`;
      } else {
        ctx.strokeStyle = `hsla(${hue}, 75%, 70%, ${density * 0.7})`;
      }
      
      ctx.lineWidth = Math.min(2.5 * density, 2.5);
      
      path.moveTo(state.positions[p1Idx], state.positions[p1Idx + 1]);
      path.lineTo(state.positions[p2Idx], state.positions[p2Idx + 1]);
      
      ctx.stroke(path);
    }
    
    ctx.restore();
    
    // Report performance stats every 60 frames
    if (state.frameCount % 60 === 0) {
      self.postMessage({
        type: 'stats',
        data: {
          fps: Math.round(1000 / elapsed),
          points: state.positions.length / 2,
          connections: state.connections.length / 2,
          frame: state.frameCount
        }
      });
    }
  }
  
  requestAnimationFrame(render);
}

self.onmessage = (e) => {
  const { type, data } = e.data;
  
  switch (type) {
    case 'init':
      canvas = data.canvas;
      ctx = canvas.getContext('2d')!;
      state.width = canvas.width;
      state.height = canvas.height;
      break;
      
    case 'treeData':
      state.positions = data.positions;
      state.properties = data.properties;
      state.connections = data.connections;
      
      if (!state.lastFrame) {
        requestAnimationFrame(render);
      }
      break;
  }
};