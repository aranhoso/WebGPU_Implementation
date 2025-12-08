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

const canvas = document.getElementById('gfx-main') as HTMLCanvasElement;

const renderer = new Renderer(canvas);
const camera = new Camera(canvas.width / canvas.height);
const scene = new Scene(renderer, camera);
const input = new Input(canvas);

// URLs do skybox (ordem: right, left, top, bottom, front, back)
const skyboxUrls = [
    'https://raw.githubusercontent.com/fegennari/3DWorld/refs/heads/master/textures/skybox/water_scene/right.jpg',
    'https://raw.githubusercontent.com/fegennari/3DWorld/refs/heads/master/textures/skybox/water_scene/left.jpg',
    'https://raw.githubusercontent.com/fegennari/3DWorld/refs/heads/master/textures/skybox/water_scene/top.jpg',
    'https://raw.githubusercontent.com/fegennari/3DWorld/refs/heads/master/textures/skybox/water_scene/bottom.jpg',
    'https://raw.githubusercontent.com/fegennari/3DWorld/refs/heads/master/textures/skybox/water_scene/front.jpg',
    'https://raw.githubusercontent.com/fegennari/3DWorld/refs/heads/master/textures/skybox/water_scene/back.jpg',
];

const startGame = async () => {
    try {
        await renderer.initialize();

        await scene.loadSkybox(skyboxUrls);

        const mapObj = await scene.loadObjectWithMaterials(
            'src/assets/Bhop_Seal/Untitled.obj'
        );

        if (!mapObj) {
            console.warn("Falha ao carregar o mapa Bhop_Seal");
        }
        
        const collision = new CollisionSystem(0.4, 1.8, 1.6);
        if (mapObj && mapObj.mesh) {
            collision.loadMeshCollision(mapObj.mesh);
        }

        const ladderSystem = new LadderSystem();
        ladderSystem.addLadderFromCorners(
            [37.693, 9.810, 6.950], //bottom right
            [38.289, 9.847, 7.781], //bottom left
            [38.331, 18.000, 7.834], //top left
            [37.835, 18.000, 7.213], //top right
            { thickness: 0.35 }
        );

        const arcticObj = await scene.loadObject(
            'src/assets/Arctic_T/Arctic_T.obj',
            'src/assets/Arctic_T/t_arctic.png'
        );

        if (!arcticObj) {
            throw new Error("Falha ao carregar o objeto Arctic_T");
        }

        const arcticArmsObj = await scene.loadObject(
            'src/assets/Arctic_T_arms/Arcitc_T-arms.obj',
            'src/assets/Arctic_T/t_arctic.png'
        );

        if (!arcticArmsObj) {
            console.warn("Falha ao carregar o objeto Arctic_T-arms");
        }

        const spawnPosition = [-24, 10, 19];
        camera.setPosition(spawnPosition);

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

        // CRT / Fisheye controls
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
            { position: [-18.518, 9.251, 20.083], radius: 2 },
            { position: [-24.217, 32.206, -8.663], radius: 2 },
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

        const speedElement = document.getElementById('speed-display');
        const groundedElement = document.getElementById('grounded-display');

        let noclipKeyPressed = false;

        scene.setAfterRender(() => {
            trailSystem.render();
        });
        
        scene.start((scene, deltaTime) => {
            const wasNoclip = previousNoclip;
            const interactPressed = input.isKeyPressed('KeyE');

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

                const eyePos = playerMovement.getEyePosition() as [number, number, number];
                chronometer.update(eyePos, false, false);

                syncCameraToPlayer();
                
                if (speedElement) {
                    const speed = playerMovement.getSpeed();
                    speedElement.textContent = `Speed: ${speed.toFixed(2)} u/s`;
                }
                if (groundedElement) {
                    groundedElement.textContent = `Grounded: ${playerMovement.getIsGrounded() ? 'Yes' : 'No'}`;
                }
            }

            // chronometer update (runs in both noclip and normal; finish blocked in noclip)
            const eyePos = playerMovement.getEyePosition() as [number, number, number];
            chronometer.update(eyePos, interactPressed, uiVisible, false, noclip);

            updateArcticArmsTransform(deltaTime);
            const anchor = noclip ? camera.position : playerMovement.getEyePosition();
            trailSystem.update(deltaTime, anchor);

            previousNoclip = noclip;
        });

    } catch (error) {
        console.error("Falha ao iniciar a engine:", error);
    }
};

startGame();