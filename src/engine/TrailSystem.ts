import { Camera } from "./Camera";
import { Renderer } from "./Renderer";

interface TrailOptions {
  maxPoints?: number;
  ttl?: number;
  spawnInterval?: number;
  yOffset?: number;
  movementEpsilon?: number;
}

export class TrailSystem {
  private renderer: Renderer;
  private getCamera: () => Camera;

  private maxPoints: number;
  private ttl: number;
  private spawnInterval: number;
  private yOffset: number;
  private movementEpsilon: number;
  private movementEpsilonSq: number;

  private data: Float32Array;
  private count = 0;
  private spawnTimer = 0;
  private lastAnchor: number[] = [0, 0, 0];
  private hasLastAnchor = false;

  constructor(
    renderer: Renderer,
    getCamera: () => Camera,
    options: TrailOptions = {}
  ) {
    this.renderer = renderer;
    this.getCamera = getCamera;

    this.maxPoints = options.maxPoints ?? 256;
    this.ttl = options.ttl ?? 0.6;
    this.spawnInterval = options.spawnInterval ?? 0.015;
    this.yOffset = options.yOffset ?? -0.6;
    this.movementEpsilon = options.movementEpsilon ?? 0.01;
    this.movementEpsilonSq = this.movementEpsilon * this.movementEpsilon;

    this.data = new Float32Array(this.maxPoints * 4); // vec3 pos + age
  }

  public update(dt: number, anchor: number[]): void {
    if (!this.hasLastAnchor) {
      this.lastAnchor[0] = anchor[0];
      this.lastAnchor[1] = anchor[1];
      this.lastAnchor[2] = anchor[2];
      this.hasLastAnchor = true;
    }

    const dx = anchor[0] - this.lastAnchor[0];
    const dy = anchor[1] - this.lastAnchor[1];
    const dz = anchor[2] - this.lastAnchor[2];

    const distSq = dx * dx + dy * dy + dz * dz;
    const moved = distSq > this.movementEpsilonSq;

    // fade pros pontos ja existentes
    let write = 0;
    for (let i = 0; i < this.count; i++) {
      const idx = i * 4;
      const age = this.data[idx + 3] + dt;
      if (age <= this.ttl) {
        if (write !== idx) {
          this.data[write] = this.data[idx];
          this.data[write + 1] = this.data[idx + 1];
          this.data[write + 2] = this.data[idx + 2];
        }
        this.data[write + 3] = age;
        write += 4;
      }
    }
    this.count = write >> 2;

    if (moved) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        if (this.count >= this.maxPoints) {
          this.data.copyWithin(0, 4, this.maxPoints * 4);
          this.count = this.maxPoints - 1;
        }
        const base = this.count << 2;
        this.data[base] = anchor[0];
        this.data[base + 1] = anchor[1] + this.yOffset;
        this.data[base + 2] = anchor[2];
        this.data[base + 3] = 0;
        this.count++;
      }
    } else {
      this.spawnTimer = 0;
    }

    this.lastAnchor[0] = anchor[0];
    this.lastAnchor[1] = anchor[1];
    this.lastAnchor[2] = anchor[2];
  }

  public render(): void {
    if (this.count === 0) return;
    const cam = this.getCamera();
    this.renderer.drawTrailInFrame(
      this.data.subarray(0, this.count * 4),
      this.count,
      cam.getViewProjectionMatrix(),
      cam.getRight(),
      cam.getUp(),
      this.ttl
    );
  }
}
