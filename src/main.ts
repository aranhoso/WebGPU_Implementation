import { mat4, vec3 } from './engine/Math';
import { Renderer } from './engine/Renderer';
import { Camera } from './engine/Camera';
import { Scene, SceneObject } from './engine/Scene';
import { Input } from './engine/Input';
import { CollisionSystem } from './engine/Collision';
import { PlayerMovement } from './engine/PlayerMovement';
import { TrailSystem } from './engine/TrailSystem';
import { LadderSystem } from './engine/LadderSystem';
import { Chronometer } from './engine/Chronometer';
import { AreaMarker } from './engine/AreaMarker';
import { DeadZoneSystem } from './engine/DeadZoneSystem';
import { CheckpointConfig, CheckpointSystem } from './engine/CheckpointSystem';

interface SkinConfig {
    id: string;
    name: string;
    description: string;
    modelPath: string;
    texturePath: string;
    armsModelPath: string;
    armsTexturePath: string;
}

const SKIN_CONFIGS: Record<string, SkinConfig> = {
    'Arctic_T': {
        id: 'Arctic_T',
        name: 'Arctic T',
        description: 'Terrorist',
        modelPath: 'src/assets/Arctic_T/Arctic_T.obj',
        texturePath: 'src/assets/Arctic_T/t_arctic.png',
        armsModelPath: 'src/assets/Arctic_T_arms/Arcitc_T-arms.obj',
        armsTexturePath: 'src/assets/Arctic_T/t_arctic.png'
    },
    'CT': {
        id: 'CT',
        name: 'Urban CT',
        description: 'Counter-Terrorist',
        modelPath: 'src/assets/CT/Aranhoso_character.obj',
        texturePath: 'src/assets/CT/texture/ct_urban.png',
        armsModelPath: 'src/assets/CT_arms/CT_arms.obj',
        armsTexturePath: 'src/assets/CT_arms/texture/ct_urban.png'
    }
};

let selectedSkinConfig: SkinConfig = SKIN_CONFIGS['Arctic_T'];

interface LadderConfig {
    bottomRight: [number, number, number];
    bottomLeft: [number, number, number];
    topLeft: [number, number, number];
    topRight: [number, number, number];
    thickness?: number;
}

interface LightingConfig {
    lightDirection: [number, number, number];
    lightIntensity: number;
    ambientIntensity: number;
    shininess: number;
}

interface MapConfig {
    name: string;
    objPath: string;
    spawnPosition: [number, number, number];
    chronometer: {
        start: { position: [number, number, number]; radius: number };
        finish: { position: [number, number, number]; radius: number };
    };
    ladders: LadderConfig[];
    lighting?: LightingConfig;
    checkpoints?: CheckpointConfig[];
    skybox: [string, string, string, string, string, string]; // right, left, top, bottom, front, back
}

const MAP_CONFIGS: Record<string, MapConfig> = {
    'Bhop_Seal': {
        name: 'Bhop Seal',
        objPath: 'src/assets/Bhop_Seal/Untitled.obj',
        spawnPosition: [-24, 10, 19],
        chronometer: {
            start: { position: [-18.518, 9.251, 20.083], radius: 2 },
            finish: { position: [-24.217, 32.206, -8.663], radius: 2 }
        },
        ladders: [
            {
                bottomRight: [37.693, 9.810, 6.950],
                bottomLeft: [38.289, 9.847, 7.781],
                topLeft: [38.331, 18.000, 7.834],
                topRight: [37.835, 18.000, 7.213],
                thickness: 0.35
            }
        ],
        skybox: [
            'src/assets/cubemaps/normal/right.jpg',
            'src/assets/cubemaps/normal/left.jpg',
            'src/assets/cubemaps/normal/top.jpg',
            'src/assets/cubemaps/normal/bottom.jpg',
            'src/assets/cubemaps/normal/front.jpg',
            'src/assets/cubemaps/normal/back.jpg'
        ]
    },
    'Bhop_XMas': {
        name: 'Bhop XMas',
        objPath: 'src/assets/Bhop_XMas/bhop_xmas.obj',
        spawnPosition: [18.52, 2.73, 12.31],
        chronometer: {
            start: { position: [18.870, 2.302, 14.176], radius: 2 },
            finish: { position: [16.593, 20.706, -33.441], radius: 2 }
        },
        ladders: [],
        lighting: {
            lightDirection: [0.00, 0.03, 0.06],
            lightIntensity: 0.53,
            ambientIntensity: 0.61,
            shininess: 4
        },
        checkpoints: [
            // 14.26, 3.69, 3.67
            // 4.69, 7.07, -0.60
            // 6.64, 6.52, -31.61
            // 17.13, 6.55, -33.18
            // 32.38, 7.54, -21.31
            // 35.35, 14.24, -15.12
            // 7.01, 14.22, 0.98
            // -3.13, 15.19, -6.79
            // 2.17, 14.26, -29.73
            { position: [14.26, 3.69, 3.67], radius: 1.2 },
            { position: [4.69, 7.07, -0.60], radius: 1.2 },
            { position: [6.64, 6.52, -31.61], radius: 1.2 },
            { position: [17.13, 6.55, -33.18], radius: 1.2 },
            { position: [32.38, 7.54, -21.31], radius: 1.2 },
            { position: [35.35, 14.24, -15.12], radius: 1.2 },
            { position: [7.01, 14.22, 0.98], radius: 1.2 },
            { position: [-3.13, 15.19, -6.79], radius: 1.2 },
            { position: [2.17, 14.26, -29.73], radius: 1.2 }
        ],
        skybox: [
            'src/assets/cubemaps/neve/right.jpg',
            'src/assets/cubemaps/neve/left.jpg',
            'src/assets/cubemaps/neve/top.jpg',
            'src/assets/cubemaps/neve/bottom.jpg',
            'src/assets/cubemaps/neve/front.jpg',
            'src/assets/cubemaps/neve/back.jpg'
        ]
    }
};

const canvas = document.getElementById('gfx-main') as HTMLCanvasElement;

const renderer = new Renderer(canvas);
const camera = new Camera(canvas.width / canvas.height);
const scene = new Scene(renderer, camera);
const input = new Input(canvas);

let selectedMapConfig: MapConfig | null = null;

const startGame = async (mapConfig: MapConfig) => {
    try {
        await renderer.initialize();

        await scene.loadSkybox(mapConfig.skybox);

        console.log(`Loading map: ${mapConfig.name}`);
        const mapObj = await scene.loadObjectWithMaterials(mapConfig.objPath);

        if (!mapObj) {
            console.warn(`Falha ao carregar o mapa ${mapConfig.name}`);
        }
        
        const collision = new CollisionSystem(0.4, 1.8, 1.6);
        if (mapObj && mapObj.mesh) {
            collision.loadMeshCollision(mapObj.mesh);
        }

        const ladderSystem = new LadderSystem();
        for (const ladder of mapConfig.ladders) {
            ladderSystem.addLadderFromCorners(
                ladder.bottomRight,
                ladder.bottomLeft,
                ladder.topLeft,
                ladder.topRight,
                { thickness: ladder.thickness ?? 0.35 }
            );
        }

        const arcticObj = await scene.loadObject(
            selectedSkinConfig.modelPath,
            selectedSkinConfig.texturePath
        );

        if (!arcticObj) {
            throw new Error(`Falha ao carregar o objeto ${selectedSkinConfig.name}`);
        }

        const arcticArmsObj = await scene.loadObject(
            selectedSkinConfig.armsModelPath,
            selectedSkinConfig.armsTexturePath
        );

        if (!arcticArmsObj) {
            console.warn(`Falha ao carregar o objeto ${selectedSkinConfig.name} arms`);
        }

        const spawnPosition: [number, number, number] = [...mapConfig.spawnPosition];
        camera.setPosition(spawnPosition);

        // Dead zone system
        const deadZoneSystem = new DeadZoneSystem();
        deadZoneSystem.setSpawnPoint(spawnPosition[0], spawnPosition[1], spawnPosition[2]);

        const checkpointSystem = new CheckpointSystem(scene, renderer, spawnPosition);
        if (mapConfig.checkpoints) {
            checkpointSystem.setCheckpoints(mapConfig.checkpoints);
        }
        
        // Add dead zones based on map
        if (mapConfig.name === 'Bhop XMas') {
            const xmasDeadZone = [
                [5.675, 5.619, -6.023],
                [4.248, 5.630, -7.662],
                [3.173, 5.630, -6.980],
                [1.660, 5.630, -9.938],
                [0.861, 5.630, -12.522],
                [0.599, 5.630, -15.590],
                [0.979, 5.630, -18.353],
                [1.765, 5.630, -21.093],
                [3.349, 5.630, -23.813],
                [5.159, 5.630, -25.991],
                [6.852, 5.630, -27.378],
                [2.905, 5.634, -33.301],
                [0.242, 5.634, -30.582],
                [-2.697, 5.634, -27.372],
                [-4.592, 5.634, -23.374],
                [-5.678, 5.634, -19.733],
                [-6.411, 5.634, -15.313],
                [-5.949, 5.634, -10.953],
                [-4.719, 5.634, -7.062],
                [-2.669, 5.634, -3.032],
                [-3.577, 5.603, -2.425],
                [-1.696, 5.603, -0.596],
                [0.085, 5.603, -0.228]
            ];
            deadZoneSystem.addDeadZone(xmasDeadZone, 2.5, 5.7, 'xmas_main_deadzone');
        }
        
        // deadzone global
        deadZoneSystem.addKillFloor(-20, 'global_kill_floor');

        const playerMovement = new PlayerMovement();
        playerMovement.setCollisionSystem(collision);
        playerMovement.setPosition(spawnPosition);
        playerMovement.setEyeHeight(1.6);

        const trailSystem = new TrailSystem(renderer, () => camera, {
            ttl: 0.6,
            spawnInterval: 0.015,
            yOffset: -2,
            movementEpsilon: 0.01,
            maxPoints: 256
        });

        let lastVy = playerMovement.getVelocity()[1];
        let armSway = 0;

        const syncCameraToPlayer = () => {
            camera.follow(playerMovement.getEyePosition());
        };

        syncCameraToPlayer();

        const forwardSlider = document.getElementById('forward-slider') as HTMLInputElement;
        const rightSlider = document.getElementById('right-slider') as HTMLInputElement;
        const upSlider = document.getElementById('up-slider') as HTMLInputElement;
        const forwardValue = document.getElementById('forward-value') as HTMLElement;
        const rightValue = document.getElementById('right-value') as HTMLElement;
        const upValue = document.getElementById('up-value') as HTMLElement;

        const chronoDisplay = (() => {
            const existing = document.getElementById('chronometer-display');
            if (existing) return existing;
            const el = document.createElement('div');
            el.id = 'chronometer-display';
            el.style.position = 'absolute';
            el.style.top = '8px';
            el.style.right = '8px';
            el.style.padding = '6px 10px';
            el.style.background = 'rgba(0,0,0,0.35)';
            el.style.color = '#fff';
            el.style.fontFamily = 'monospace';
            el.style.fontSize = '14px';
            el.style.pointerEvents = 'none';
            document.body.appendChild(el);
            return el;
        })();

        const debugInfo = document.getElementById('debug-info') as HTMLElement;
        const armsControls = document.getElementById('arms-controls') as HTMLElement;
        const lightingControls = document.getElementById('lighting-controls') as HTMLElement;
        const postfxControls = document.getElementById('postfx-controls') as HTMLElement;

        let uiVisible = false;
        const uiPanels = [debugInfo, armsControls, lightingControls, postfxControls];

        const applyUIVisibility = () => {
            for (const el of uiPanels) {
                if (!el) continue;
                el.style.display = uiVisible ? '' : 'none';
            }
        };

        applyUIVisibility();

        window.addEventListener('keydown', (ev) => {
            if (ev.code === 'Insert') {
                uiVisible = !uiVisible;
                applyUIVisibility();
            }
        });

        if (forwardSlider && forwardValue) {
            forwardValue.textContent = forwardSlider.value;
            forwardSlider.addEventListener('input', () => {
                forwardValue.textContent = forwardSlider.value;
            });
        }
        if (rightSlider && rightValue) {
            rightValue.textContent = rightSlider.value;
            rightSlider.addEventListener('input', () => {
                rightValue.textContent = rightSlider.value;
            });
        }
        if (upSlider && upValue) {
            upValue.textContent = upSlider.value;
            upSlider.addEventListener('input', () => {
                upValue.textContent = upSlider.value;
            });
        }

        const fisheyeSlider = document.getElementById('fisheye-slider') as HTMLInputElement;
        const scanlineSlider = document.getElementById('scanline-slider') as HTMLInputElement;
        const rgbOffsetSlider = document.getElementById('rgbOffset-slider') as HTMLInputElement;
        const vignetteSlider = document.getElementById('vignette-slider') as HTMLInputElement;
        const waveAmpSlider = document.getElementById('waveAmp-slider') as HTMLInputElement;
        const waveFreqSlider = document.getElementById('waveFreq-slider') as HTMLInputElement;
        const jitterSlider = document.getElementById('jitter-slider') as HTMLInputElement;

        const fisheyeValue = document.getElementById('fisheye-value') as HTMLElement;
        const scanlineValue = document.getElementById('scanline-value') as HTMLElement;
        const rgbOffsetValue = document.getElementById('rgbOffset-value') as HTMLElement;
        const vignetteValue = document.getElementById('vignette-value') as HTMLElement;
        const waveAmpValue = document.getElementById('waveAmp-value') as HTMLElement;
        const waveFreqValue = document.getElementById('waveFreq-value') as HTMLElement;
        const jitterValue = document.getElementById('jitter-value') as HTMLElement;

        const syncPostFx = () => {
            const fisheye = parseFloat(fisheyeSlider?.value ?? '0.5');
            const scan = parseFloat(scanlineSlider?.value ?? '0.175');
            const rgb = parseFloat(rgbOffsetSlider?.value ?? '0.001');
            const vig = parseFloat(vignetteSlider?.value ?? '0.3');
            const wAmp = parseFloat(waveAmpSlider?.value ?? '0.0002');
            const wFreq = parseFloat(waveFreqSlider?.value ?? '5');
            const jitter = parseFloat(jitterSlider?.value ?? '0.0003');

            renderer.setFisheyeStrength(fisheye);
            renderer.setScanLineIntensity(scan);
            renderer.setRgbOffset(rgb);
            renderer.setVignetteIntensity(vig);
            renderer.setWaveAmplitude(wAmp);
            renderer.setWaveFrequency(wFreq);
            renderer.setJitterIntensity(jitter);

            if (fisheyeValue) fisheyeValue.textContent = fisheye.toFixed(2);
            if (scanlineValue) scanlineValue.textContent = scan.toFixed(3);
            if (rgbOffsetValue) rgbOffsetValue.textContent = rgb.toFixed(4);
            if (vignetteValue) vignetteValue.textContent = vig.toFixed(2);
            if (waveAmpValue) waveAmpValue.textContent = wAmp.toFixed(4);
            if (waveFreqValue) waveFreqValue.textContent = wFreq.toFixed(2);
            if (jitterValue) jitterValue.textContent = jitter.toFixed(4);
        };

        fisheyeSlider?.addEventListener('input', syncPostFx);
        scanlineSlider?.addEventListener('input', syncPostFx);
        rgbOffsetSlider?.addEventListener('input', syncPostFx);
        vignetteSlider?.addEventListener('input', syncPostFx);
        waveAmpSlider?.addEventListener('input', syncPostFx);
        waveFreqSlider?.addEventListener('input', syncPostFx);
        jitterSlider?.addEventListener('input', syncPostFx);

        const lightDirXSlider = document.getElementById('lightDirX-slider') as HTMLInputElement;
        const lightDirYSlider = document.getElementById('lightDirY-slider') as HTMLInputElement;
        const lightDirZSlider = document.getElementById('lightDirZ-slider') as HTMLInputElement;
        const lightIntensitySlider = document.getElementById('lightIntensity-slider') as HTMLInputElement;
        const ambientSlider = document.getElementById('ambient-slider') as HTMLInputElement;
        const shininessSlider = document.getElementById('shininess-slider') as HTMLInputElement;

        const lightDirXValue = document.getElementById('lightDirX-value') as HTMLElement;
        const lightDirYValue = document.getElementById('lightDirY-value') as HTMLElement;
        const lightDirZValue = document.getElementById('lightDirZ-value') as HTMLElement;
        const lightIntensityValue = document.getElementById('lightIntensity-value') as HTMLElement;
        const ambientValue = document.getElementById('ambient-value') as HTMLElement;
        const shininessValue = document.getElementById('shininess-value') as HTMLElement;

        const chronometer = new Chronometer(
            mapConfig.chronometer.start,
            mapConfig.chronometer.finish,
            chronoDisplay,
            scene
            );

        const syncLighting = () => {
            const dir: [number, number, number] = [
                parseFloat(lightDirXSlider?.value ?? '1'),
                parseFloat(lightDirYSlider?.value ?? '1'),
                parseFloat(lightDirZSlider?.value ?? '1')
            ];

            renderer.setLightDirection(dir);
            renderer.setLightIntensity(parseFloat(lightIntensitySlider?.value ?? '1'));
            renderer.setAmbientIntensity(parseFloat(ambientSlider?.value ?? '0.2'));
            renderer.setShininess(parseFloat(shininessSlider?.value ?? '64'));

            if (lightDirXValue) lightDirXValue.textContent = dir[0].toFixed(2);
            if (lightDirYValue) lightDirYValue.textContent = dir[1].toFixed(2);
            if (lightDirZValue) lightDirZValue.textContent = dir[2].toFixed(2);
            if (lightIntensityValue) lightIntensityValue.textContent = (lightIntensitySlider ? parseFloat(lightIntensitySlider.value) : 1).toFixed(2);
            if (ambientValue) ambientValue.textContent = (ambientSlider ? parseFloat(ambientSlider.value) : 0.2).toFixed(2);
            if (shininessValue) shininessValue.textContent = shininessSlider ? shininessSlider.value : '64';
        };

        lightDirXSlider?.addEventListener('input', syncLighting);
        lightDirYSlider?.addEventListener('input', syncLighting);
        lightDirZSlider?.addEventListener('input', syncLighting);
        lightIntensitySlider?.addEventListener('input', syncLighting);
        ambientSlider?.addEventListener('input', syncLighting);
        shininessSlider?.addEventListener('input', syncLighting);

        if (mapConfig.lighting) {
            const l = mapConfig.lighting;
            if (lightDirXSlider) lightDirXSlider.value = l.lightDirection[0].toString();
            if (lightDirYSlider) lightDirYSlider.value = l.lightDirection[1].toString();
            if (lightDirZSlider) lightDirZSlider.value = l.lightDirection[2].toString();
            if (lightIntensitySlider) lightIntensitySlider.value = l.lightIntensity.toString();
            if (ambientSlider) ambientSlider.value = l.ambientIntensity.toString();
            if (shininessSlider) shininessSlider.value = l.shininess.toString();
        }

        syncLighting();
        syncPostFx();

        const updateArcticArmsTransform = (dt: number = 0) => {
            if (!arcticArmsObj) return;

            const front = camera.getFront();
            const right = camera.getRight();
            const up = camera.getUp();
            const anchor = noclip ? camera.position : playerMovement.getEyePosition();

            const forwardOffset = forwardSlider ? parseFloat(forwardSlider.value) : 0;
            const rightOffset = rightSlider ? parseFloat(rightSlider.value) : 0;
            const upOffset = upSlider ? parseFloat(upSlider.value) : -1.85;

            const offsetForward = vec3.scale(front, forwardOffset);
            const offsetRight = vec3.scale(right, rightOffset);
            const offsetUp = vec3.scale(up, upOffset);

            const finalPos = vec3.add(vec3.add(vec3.add(anchor, offsetForward), offsetRight), offsetUp);

            const vy = playerMovement.getVelocity()[1];
            const accelY = dt > 0 ? (vy - lastVy) / dt : 0;
            const targetSway = Math.max(-0.15, Math.min(0.15, accelY * 0.01));
            const lerpFactor = Math.min(1, dt * 10);
            armSway = armSway + (targetSway - armSway) * lerpFactor;
            armSway = Math.max(-0.15, Math.min(0.15, armSway));
            finalPos[1] += armSway;
            lastVy = vy;

            const r = right;
            const u = up;
            const f = front;

            arcticArmsObj.modelMatrix = [
                r[0], r[1], r[2], 0,
                u[0], u[1], u[2], 0,
                f[0], f[1], f[2], 0,
                finalPos[0], finalPos[1], finalPos[2], 1,
            ];
        };

        let noclip = false;
        let previousNoclip = false;

        let pickKeyPressed = false;
        let resetKeyPressed = false;
        let checkpointTeleportPressed = false;

        const speedElement = document.getElementById('speed-display');
        const groundedElement = document.getElementById('grounded-display');

        let noclipKeyPressed = false;

        const areaMarker = new AreaMarker();

        let wasChronoRunning = false;

        const getPlayerPosition = (): [number, number, number] => {
            const pos = noclip ? camera.position : playerMovement.getEyePosition();
            return [pos[0], pos[1], pos[2]];
        };

        scene.setAfterRender(() => {
            trailSystem.render();
        });
        
        scene.start((scene, deltaTime) => {
            const wasNoclip = previousNoclip;
            const interactPressed = input.isKeyPressed('KeyE');

            areaMarker.update(input, getPlayerPosition);

            if (input.isKeyPressed('KeyN')) {
                if (!noclipKeyPressed) {
                    noclip = !noclip;
                    console.log(`Noclip: ${noclip ? 'ATIVADO' : 'DESATIVADO'}`);
                    noclipKeyPressed = true;
                }
            } else {
                noclipKeyPressed = false;
            }

            if (input.isKeyPressed('KeyR')) {
                if (!resetKeyPressed) {
                    chronometer.reset();
                    playerMovement.setPosition([...spawnPosition]);
                    playerMovement.velocity = [0, 0, 0];
                    camera.setPosition([...spawnPosition]);
                    checkpointSystem.resetToSpawn();
                    syncCameraToPlayer();
                    resetKeyPressed = true;
                }
            } else {
                resetKeyPressed = false;
            }

            if (input.isKeyPressed('KeyP')) {
                if (!pickKeyPressed) {
                    const origin = [...camera.position];
                    const dir = camera.getFront();
                    const hit = collision.raycast(origin, dir, 4000);
                    if (hit) {
                        const p = hit.point;
                        console.log(`Look hit: (${p[0].toFixed(3)}, ${p[1].toFixed(3)}, ${p[2].toFixed(3)}) dist=${hit.distance.toFixed(2)}`);
                    } else {
                        console.log('Look hit: none');
                    }
                    pickKeyPressed = true;
                }
            } else {
                pickKeyPressed = false;
            }

            const noclipDisabledThisFrame = wasNoclip && !noclip;
            if (noclipDisabledThisFrame) {
                playerMovement.setPosition([...camera.position]);
                playerMovement.velocity = [0, 0, 0];
                syncCameraToPlayer();
            }

            if (input.isLocked()) {
                const mouseDelta = input.getMouseDelta();
                camera.updateRotation(mouseDelta.x, mouseDelta.y);
            }

            if (noclip) {
                // modo noclip
                const noclipSpeed = 15;
                if (input.isKeyPressed('KeyW')) camera.move('FORWARD', noclipSpeed * deltaTime);
                if (input.isKeyPressed('KeyS')) camera.move('BACKWARD', noclipSpeed * deltaTime);
                if (input.isKeyPressed('KeyA')) camera.move('LEFT', noclipSpeed * deltaTime);
                if (input.isKeyPressed('KeyD')) camera.move('RIGHT', noclipSpeed * deltaTime);
                if (input.isKeyPressed('Space')) camera.move('UP', noclipSpeed * deltaTime);
                if (input.isKeyPressed('ControlLeft') || input.isKeyPressed('ControlRight')) camera.move('DOWN', noclipSpeed * deltaTime);
            } else {
                // modo normal
                playerMovement.updateDirections(camera.getFront(), camera.getRight());
                
                const onLadder = ladderSystem.update(deltaTime, playerMovement, input, collision);

                if (!onLadder) {
                    let inputX = 0;
                    let inputZ = 0;
                    
                    if (input.isKeyPressed('KeyW')) inputZ += 1;
                    if (input.isKeyPressed('KeyS')) inputZ -= 1;
                    if (input.isKeyPressed('KeyA')) inputX -= 1;
                    if (input.isKeyPressed('KeyD')) inputX += 1;
                    
                    const jumpPressed = input.isKeyPressed('Space');
                    
                    playerMovement.update(deltaTime, inputX, inputZ, jumpPressed);
                }

                // verifica se tá na deadzone
                const playerPos = playerMovement.getEyePosition();
                if (deadZoneSystem.checkPlayerInDeadZone(playerPos)) {
                    const target = chronometer.isRunning() ? checkpointSystem.getLastCheckpoint() : deadZoneSystem.getSpawnPoint();
                    playerMovement.setPosition(target);
                    playerMovement.velocity = [0, 0, 0];
                    if (!chronometer.isRunning()) {
                        chronometer.reset();
                        checkpointSystem.resetToSpawn();
                    }
                    syncCameraToPlayer();
                }
                const chronoRunning = chronometer.isRunning();
                if (chronoRunning) {
                    checkpointSystem.update(playerMovement.getEyePosition() as [number, number, number]);
                }

                syncCameraToPlayer();
                
                if (speedElement) {
                    const speed = playerMovement.getSpeed();
                    speedElement.textContent = `Speed: ${speed.toFixed(2)} u/s`;
                }
                if (groundedElement) {
                    groundedElement.textContent = `Grounded: ${playerMovement.getIsGrounded() ? 'Yes' : 'No'}`;
                }
            }

            const eyePos = playerMovement.getEyePosition() as [number, number, number];
            chronometer.update(eyePos, interactPressed, uiVisible, false, noclip);

            const chronoRunning = chronometer.isRunning();
            checkpointSystem.setActive(chronoRunning);

            const teleportKeyDown = input.isKeyPressed('KeyT');
            if (teleportKeyDown && chronoRunning && !checkpointTeleportPressed && !noclip) {
                const target = checkpointSystem.getLastCheckpoint();
                playerMovement.setPosition(target);
                playerMovement.velocity = [0, 0, 0];
                syncCameraToPlayer();
                checkpointTeleportPressed = true;
            }
            if (!teleportKeyDown) {
                checkpointTeleportPressed = false;
            }

            if (!chronoRunning && wasChronoRunning) {
                checkpointSystem.setActive(false);
            }
            wasChronoRunning = chronoRunning;

            updateArcticArmsTransform(deltaTime);
            const anchor = noclip ? camera.position : playerMovement.getEyePosition();
            trailSystem.update(deltaTime, anchor);

            previousNoclip = noclip;
        });

    } catch (error) {
        console.error("Falha ao iniciar a engine:", error);
    }
};

const setupMenuSystem = () => {
    const mainMenu = document.getElementById('main-menu');
    const mapSelectScreen = document.getElementById('map-select-screen');
    const skinSelectScreen = document.getElementById('skin-select-screen');
    const loadingIndicator = document.getElementById('loading-indicator');
    const mapCards = document.querySelectorAll('.map-card');
    const skinCards = document.querySelectorAll('.skin-card');
    const backToMapsBtn = document.getElementById('back-to-maps');

    let pendingMapConfig: MapConfig | null = null;

    mapCards.forEach(card => {
        card.addEventListener('click', () => {
            const mapId = card.getAttribute('data-map');
            if (!mapId || !MAP_CONFIGS[mapId]) {
                console.error(`Map config not found: ${mapId}`);
                return;
            }

            pendingMapConfig = MAP_CONFIGS[mapId];
            
            if (mapSelectScreen) mapSelectScreen.classList.remove('active');
            if (skinSelectScreen) skinSelectScreen.classList.add('active');
        });
    });

    if (backToMapsBtn) {
        backToMapsBtn.addEventListener('click', () => {
            if (skinSelectScreen) skinSelectScreen.classList.remove('active');
            if (mapSelectScreen) mapSelectScreen.classList.add('active');
            pendingMapConfig = null;
        });
    }

    skinCards.forEach(card => {
        card.addEventListener('click', async () => {
            const skinId = card.getAttribute('data-skin');
            if (!skinId || !SKIN_CONFIGS[skinId]) {
                console.error(`Skin config not found: ${skinId}`);
                return;
            }

            if (!pendingMapConfig) {
                console.error('No map selected');
                return;
            }

            selectedSkinConfig = SKIN_CONFIGS[skinId];
            selectedMapConfig = pendingMapConfig;

            if (skinSelectScreen) skinSelectScreen.classList.remove('active');
            if (loadingIndicator) loadingIndicator.style.display = 'block';

            try {
                await startGame(selectedMapConfig);
                
                if (mainMenu) {
                    mainMenu.classList.add('hidden');
                }
            } catch (error) {
                console.error('Falha ao iniciar o jogo:', error);
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                if (mapSelectScreen) mapSelectScreen.classList.add('active');
            }
        });
    });
};

setupMenuSystem();