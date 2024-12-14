export interface Point {
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
  }
  
  export interface Connection {
    p1: Point;
    p2: Point;
    distSq: number;
    baseAlpha: number;
    density: number;
    hue: number;
    lineWidth: number;
    colorKey: string;
  }
  
  export interface TreeState {
    points: Point[];
    staticPoints: Point[];
    connections: Connection[];
    grid: Record<string, Point[]>;
    ctx: CanvasRenderingContext2D | null;
    cellSize: number;
    canvasWidth: number;
    canvasHeight: number;
    frameCount: number;
    lastGridUpdate: number;
    lastFrame: number;
    animationFrame: number;
    connectionColors: Map<string, string>;
  }
  
  export type WorkerMessage = {
    type: 'init' | 'update';
    data: any;
  }
  
  export type WorkerInitData = {
    width: number;
    height: number;
  }
  
  export type WorkerUpdateData = {
    time: number;
  }