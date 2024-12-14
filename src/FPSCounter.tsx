import React, { useEffect, useState } from 'react';

const FPSCounter = () => {
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState(0);
  
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const updateFPS = () => {
      const now = performance.now();
      frameCount++;
      
      if (now - lastTime > 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
        
        // Update memory if available
        if (performance.memory) {
          setMemory(Math.round(performance.memory.usedJSHeapSize / 1048576));
        }
      }
      
      requestAnimationFrame(updateFPS);
    };
    
    const handle = requestAnimationFrame(updateFPS);
    return () => cancelAnimationFrame(handle);
  }, []);

  return (
    <div className="fixed top-0 left-0 bg-black bg-opacity-50 text-white p-2 font-mono text-sm">
      <div>FPS: {fps}</div>
      {memory > 0 && <div>Memory: {memory}MB</div>}
    </div>
  );
};

export default FPSCounter;