import { vec3 } from './Math';
import { CollisionSystem } from './Collision';

export class PlayerMovement {
    public position: number[] = [0, 0, 0];
    public velocity: number[] = [0, 0, 0];
    
    private forward: number[] = [0, 0, -1];
    private right: number[] = [1, 0, 0];
    
    // configs de movimentação baseadas na source
    private gravity: number = -20;
    private moveSpeed: number = 7.0;             // velocidade no chão
    private runAcceleration: number = 14;        // aceleração no chão
    private runDeacceleration: number = 10;      // desaceleração no chão
    private airAcceleration: number = 2.0;       // aceleração no ar
    private airDeacceleration: number = 2.0;     // desaceleração no ar
    private airControl: number = 0.3;            // precisão do controle no ar
    private sideStrafeAcceleration: number = 50; // aceleração lateral (strafe)
    private sideStrafeSpeed: number = 1;         // velocidade máxima do strafe
    private jumpSpeed: number = 8.0;             // força do pulo
    private friction: number = 6;                // fricção no chão
    
    private eyeHeight: number = 1.6;
    
    private isGrounded: boolean = false;
    private wishJump: boolean = false;
    private jumpQueued: boolean = false;
    private jumpReleased: boolean = true;
    private groundedTime: number = 0;
    private lastGroundY: number = 0;
    
    private stepHeight: number = 0.1; // altura max do degrau que o personagem pode subir
    
    private minGroundNormalY: number = 0.7; // cos(45°) - superfícies mais íngremes causam slide
    private slopeSlideSpeed: number = 10; // velocidade do deslize em desniveis
    private isOnSteepSlope: boolean = false;
    private groundNormal: number[] = [0, 1, 0];
    
    private collision: CollisionSystem | null = null;

    private readonly _tempNewPos: number[] = [0, 0, 0];
    private readonly _tempEyePos: number[] = [0, 0, 0];
    private readonly _tempWishDir: number[] = [0, 0, 0];
    
    constructor() {}
    
    public setCollisionSystem(collision: CollisionSystem): void {
        this.collision = collision;
        if (collision) {
            this.minGroundNormalY = collision.getMinGroundNormalY();
        }
    }
    
    public setPosition(pos: number[]): void {
        this.position[0] = pos[0];
        this.position[1] = pos[1];
        this.position[2] = pos[2];
    }
    
    public getPosition(): number[] {
        return this.position;
    }

    public getEyePosition(): number[] {
        this._tempEyePos[0] = this.position[0];
        this._tempEyePos[1] = this.position[1];
        this._tempEyePos[2] = this.position[2];
        return this._tempEyePos;
    }
    
    public getVelocity(): number[] {
        return this.velocity;
    }
    
    public getSpeed(): number {
        return Math.sqrt(this.velocity[0] * this.velocity[0] + this.velocity[2] * this.velocity[2]);
    }
    
    public updateDirections(cameraFront: number[], cameraRight: number[]): void {
        this.forward = vec3.normalize([cameraFront[0], 0, cameraFront[2]]);
        this.right = vec3.normalize([cameraRight[0], 0, cameraRight[2]]);
    }
    
    public queueJump(jumpPressed: boolean): void {
        if (!jumpPressed) {
            this.jumpReleased = true;
            this.jumpQueued = false;
        }
        
        if (jumpPressed && this.isGrounded) {
            if (this.jumpReleased || this.jumpQueued) {
                this.wishJump = true;
                this.jumpReleased = false;
                this.jumpQueued = false;
            }
        }
        
        if (!this.isGrounded && jumpPressed) {
            this.jumpQueued = true;
        }
    }
    
    public update(deltaTime: number, inputX: number, inputZ: number, jumpPressed: boolean): void {
        this.checkGrounded();
        
        this.queueJump(jumpPressed);
        
        if (this.isGrounded) {
            this.groundMove(deltaTime, inputX, inputZ);
        } else if (this.isOnSteepSlope) {
            this.slopeSlideMove(deltaTime, inputX, inputZ);
        } else {
            this.airMove(deltaTime, inputX, inputZ);
        }

        const newPos = [
            this.position[0] + this.velocity[0] * deltaTime,
            this.position[1] + this.velocity[1] * deltaTime,
            this.position[2] + this.velocity[2] * deltaTime
        ];

        if (this.collision) {
            const resolvedPos = this.collision.resolveCollision(this.position, newPos);

            if (resolvedPos[1] > newPos[1] && this.velocity[1] < 0) {
                this.velocity[1] = 0;
            }
            
            this.position = resolvedPos;
        } else {
            this.position = newPos;
        }
    }

    private checkGrounded(): void {
        if (this.collision) {
            const groundInfo = this.collision.getGroundInfo(this.position);
            if (groundInfo !== null) {
                const groundHeight = groundInfo.height;
                this.groundNormal = groundInfo.normal;
                
                const feetY = this.position[1] - this.eyeHeight;
                const distanceToGround = feetY - groundHeight;

                // só considera grounded se a superfície for caminhável
                const closeToGround = distanceToGround <= 0.2 && distanceToGround >= -0.1;
                this.isOnSteepSlope = closeToGround && !groundInfo.isWalkable;
                this.isGrounded = closeToGround && groundInfo.isWalkable;
                
                const isRising = this.velocity[1] > 0.5;
                
                if (this.isGrounded && !isRising) {
                    if (distanceToGround < 0) {
                        this.position[1] = groundHeight + this.eyeHeight;
                    }
                    
                    if (this.velocity[1] < 0) {
                        this.velocity[1] = 0;
                    }
                    
                    this.lastGroundY = groundHeight;
                    this.groundedTime += 0.016;
                } else if (!isRising) {
                    if (this.groundedTime > 0 && distanceToGround < this.stepHeight && distanceToGround > 0) {
                        if (groundHeight > this.lastGroundY - 0.1) {
                            this.position[1] = groundHeight + this.eyeHeight;
                            this.isGrounded = true;
                            if (this.velocity[1] < 0) {
                                this.velocity[1] = 0;
                            }
                        }
                    }
                    
                    if (!this.isGrounded) {
                        this.groundedTime = 0;
                    }
                } else {
                    this.isGrounded = false;
                    this.groundedTime = 0;
                }
            } else {
                this.isGrounded = false;
                this.groundedTime = 0;
            }
        } else {
            this.isGrounded = this.position[1] <= this.eyeHeight + 0.1;
        }
    }
    
    private groundMove(deltaTime: number, inputX: number, inputZ: number): void {
        if (!this.wishJump) {
            this.applyFriction(deltaTime, 1.0);
        } else {
            this.applyFriction(deltaTime, 0);
        }
        
        let wishdir = this.getWishDirection(inputX, inputZ);
        const wishlen = vec3.length(wishdir);
        const wishspeed = Math.min(1, wishlen) * this.moveSpeed; // clamp diagonal speed
        wishdir = wishlen > 0 ? vec3.normalize(wishdir) : [0, 0, 0];
        
        this.accelerate(wishdir, wishspeed, this.runAcceleration, deltaTime);
        
        this.velocity[1] = 0;
        
        if (this.wishJump) {
            this.velocity[1] = this.jumpSpeed;
            this.wishJump = false;
            this.isGrounded = false;
        }
    }
    

    // surfing bem primitivo
    private slopeSlideMove(deltaTime: number, inputX: number, inputZ: number): void {
        const slideDir = this.getSlopeSlideDirection();
        
        const slideAccel = this.slopeSlideSpeed * (1 - this.groundNormal[1]);
        this.velocity[0] += slideDir[0] * slideAccel * deltaTime;
        this.velocity[2] += slideDir[2] * slideAccel * deltaTime;
        
        let wishdir = this.getWishDirection(inputX, inputZ);
        const wishlen = vec3.length(wishdir);
        let wishspeed = Math.min(1, wishlen) * this.moveSpeed * 0.3;
        wishdir = wishlen > 0 ? vec3.normalize(wishdir) : [0, 0, 0];
        
        this.accelerate(wishdir, wishspeed, this.airAcceleration, deltaTime);
        
        this.applyFriction(deltaTime, 0.3);
        
        this.velocity[1] += this.gravity * deltaTime;
        
        this.wishJump = false;
    }
    
    private getSlopeSlideDirection(): number[] {
        const gravityVec = [0, -1, 0];
        const dot = gravityVec[0] * this.groundNormal[0] + 
                    gravityVec[1] * this.groundNormal[1] + 
                    gravityVec[2] * this.groundNormal[2];
        
        const slideDir = [
            gravityVec[0] - dot * this.groundNormal[0],
            0,
            gravityVec[2] - dot * this.groundNormal[2]
        ];
        
        const len = Math.sqrt(slideDir[0] * slideDir[0] + slideDir[2] * slideDir[2]);
        if (len > 0.001) {
            slideDir[0] /= len;
            slideDir[2] /= len;
        }
        
        return slideDir;
    }
    
    private airMove(deltaTime: number, inputX: number, inputZ: number): void {
        let wishdir = this.getWishDirection(inputX, inputZ);
        const wishlen = vec3.length(wishdir);
        let wishspeed = Math.min(1, wishlen) * this.moveSpeed;
        wishdir = wishlen > 0 ? vec3.normalize(wishdir) : [0, 0, 0];
        
        let accel: number;
        const velDotWish = this.dot2D(this.velocity, wishdir);
        
        if (velDotWish < 0) {
            accel = this.airDeacceleration;
        } else {
            accel = this.airAcceleration;
        }
        
        if (inputZ === 0 && inputX !== 0) {
            if (wishspeed > this.sideStrafeSpeed) {
                wishspeed = this.sideStrafeSpeed;
            }
            accel = this.sideStrafeAcceleration;
        }
        
        this.accelerate(wishdir, wishspeed, accel, deltaTime);
        
        this.airControlMove(wishdir, wishspeed, deltaTime);
        
        this.velocity[1] += this.gravity * deltaTime;
    }
    
    private airControlMove(wishdir: number[], wishspeed: number, deltaTime: number): void {
        if (Math.abs(wishdir[0]) < 0.001 && Math.abs(wishdir[2]) < 0.001) return;
        if (wishspeed === 0) return;
        
        const zspeed = this.velocity[1];
        this.velocity[1] = 0;
        
        const speed = Math.sqrt(this.velocity[0] * this.velocity[0] + this.velocity[2] * this.velocity[2]);
        if (speed < 0.001) {
            this.velocity[1] = zspeed;
            return;
        }
        
        const velNorm = [this.velocity[0] / speed, 0, this.velocity[2] / speed];
        
        const dot = this.dot2D(velNorm, wishdir);
        let k = 32 * this.airControl * dot * dot * deltaTime;
        
        if (dot > 0) {
            this.velocity[0] = velNorm[0] * speed + wishdir[0] * k;
            this.velocity[2] = velNorm[2] * speed + wishdir[2] * k;
            
            const newSpeed = Math.sqrt(this.velocity[0] * this.velocity[0] + this.velocity[2] * this.velocity[2]);
            if (newSpeed > 0.001) {
                this.velocity[0] = (this.velocity[0] / newSpeed) * speed;
                this.velocity[2] = (this.velocity[2] / newSpeed) * speed;
            }
        }
        
        this.velocity[1] = zspeed;
    }
    
    private accelerate(wishdir: number[], wishspeed: number, accel: number, deltaTime: number): void {
        const currentspeed = this.dot2D(this.velocity, wishdir);
        
        const addspeed = wishspeed - currentspeed;
        
        if (addspeed <= 0) return;
        
        let accelspeed = accel * deltaTime * wishspeed;
        
        if (accelspeed > addspeed) {
            accelspeed = addspeed;
        }
        
        this.velocity[0] += accelspeed * wishdir[0];
        this.velocity[2] += accelspeed * wishdir[2];
    }

    private applyFriction(deltaTime: number, frictionMult: number): void {
        const speed = Math.sqrt(this.velocity[0] * this.velocity[0] + this.velocity[2] * this.velocity[2]);
        
        if (speed < 0.1) {
            this.velocity[0] = 0;
            this.velocity[2] = 0;
            return;
        }
        
        let drop = 0;
        
        if (this.isGrounded) {
            const control = speed < this.runDeacceleration ? this.runDeacceleration : speed;
            drop = control * this.friction * deltaTime * frictionMult;
        }
        
        let newspeed = speed - drop;
        if (newspeed < 0) newspeed = 0;
        newspeed /= speed;
        
        this.velocity[0] *= newspeed;
        this.velocity[2] *= newspeed;
    }
    
    private getWishDirection(inputX: number, inputZ: number): number[] {
        const wishdir = [
            this.forward[0] * inputZ + this.right[0] * inputX,
            0,
            this.forward[2] * inputZ + this.right[2] * inputX
        ];
        
        return wishdir;
    }
    
    private dot2D(a: number[], b: number[]): number {
        return a[0] * b[0] + a[2] * b[2];
    }
    
    public getIsGrounded(): boolean {
        return this.isGrounded;
    }
    
    public getIsOnSteepSlope(): boolean {
        return this.isOnSteepSlope;
    }
    
    public getGroundNormal(): number[] {
        return this.groundNormal;
    }
    
    public setEyeHeight(height: number): void {
        this.eyeHeight = height;
    }
}
