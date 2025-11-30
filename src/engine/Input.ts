export class Input {
    private keys: Set<string> = new Set();
    private mouseMovement: { x: number, y: number } = { x: 0, y: 0 };
    private isPointerLocked: boolean = false;
    private canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.setupKeyboardListeners();
        this.setupMouseListeners();
        this.setupPointerLock();
    }

    private setupKeyboardListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys.add(e.code);
        });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.code);
        });
    }

    private setupMouseListeners() {
        document.addEventListener('mousemove', (e) => {
            if (this.isPointerLocked) {
                this.mouseMovement.x += e.movementX;
                this.mouseMovement.y += e.movementY;
            }
        });
    }

    private setupPointerLock() {
        this.canvas.addEventListener('click', () => {
            if (!this.isPointerLocked) {
                this.canvas.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === this.canvas;
        });

    }

    public isKeyPressed(code: string): boolean {
        return this.keys.has(code);
    }

    public getMouseDelta(): { x: number, y: number } {
        const delta = { ...this.mouseMovement };
        this.mouseMovement.x = 0;
        this.mouseMovement.y = 0;
        return delta;
    }

    public isLocked(): boolean {
        return this.isPointerLocked;
    }
}