import { Input } from "./Input";

export class AreaMarker {
  private points: [number, number, number][] = [];
  private isActive: boolean = false;

  private leftArrowPressed: boolean = false;
  private upArrowPressed: boolean = false;
  private downArrowPressed: boolean = false;
  private rightArrowPressed: boolean = false;

  constructor() {}

  public update(
    input: Input,
    getPosition: () => [number, number, number]
  ): void {
    if (input.isKeyPressed("ArrowLeft")) {
      if (!this.leftArrowPressed) {
        this.points = [];
        this.isActive = true;
        console.log(
          "%c[Area Marking] Started new area. Press ↑ to add points.",
          "color: #00ff00; font-weight: bold"
        );
        this.leftArrowPressed = true;
      }
    } else {
      this.leftArrowPressed = false;
    }

    if (input.isKeyPressed("ArrowUp")) {
      if (!this.upArrowPressed && this.isActive) {
        const pos = getPosition();
        this.points.push(pos);
        console.log(
          `%c[Area Marking] Point ${
            this.points.length
          } added: [${pos[0].toFixed(3)}, ${pos[1].toFixed(
            3
          )}, ${pos[2].toFixed(3)}]`,
          "color: #00ffff"
        );
        this.upArrowPressed = true;
      }
    } else {
      this.upArrowPressed = false;
    }

    if (input.isKeyPressed("ArrowDown")) {
      if (!this.downArrowPressed && this.isActive && this.points.length > 0) {
        const removed = this.points.pop();
        console.log(
          `%c[Area Marking] Removed point: [${removed![0].toFixed(
            3
          )}, ${removed![1].toFixed(3)}, ${removed![2].toFixed(3)}]. ${
            this.points.length
          } points remaining.`,
          "color: #ffaa00"
        );
        this.downArrowPressed = true;
      }
    } else {
      this.downArrowPressed = false;
    }

    if (input.isKeyPressed("ArrowRight")) {
      if (!this.rightArrowPressed && this.isActive) {
        this.exportArea();
        this.rightArrowPressed = true;
      }
    } else {
      this.rightArrowPressed = false;
    }
  }

  private exportArea(): void {
    this.isActive = false;
    console.log(
      "%c[Area Marking] Area completed! Exporting coordinates:",
      "color: #00ff00; font-weight: bold"
    );
    console.log(`Total points: ${this.points.length}`);
    console.log("Points array:");
    console.log(JSON.stringify(this.points, null, 2));
    console.log("Formatted for code:");
    this.points.forEach((p, i) => {
      console.log(
        `  [${p[0].toFixed(3)}, ${p[1].toFixed(3)}, ${p[2].toFixed(3)}]${
          i < this.points.length - 1 ? "," : ""
        } // Point ${i + 1}`
      );
    });
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public getPoints(): [number, number, number][] {
    return [...this.points];
  }

  public reset(): void {
    this.points = [];
    this.isActive = false;
  }
}
