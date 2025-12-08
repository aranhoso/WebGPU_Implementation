import { mat4, vec3 } from './engine/Math';
import { Renderer } from './engine/Renderer';
import { Camera } from './engine/Camera';
import { Scene, SceneObject } from './engine/Scene';
import { Input } from './engine/Input';
import { CollisionSystem } from './engine/Collision';
import { PlayerMovement } from './engine/PlayerMovement';

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

        const syncCameraToPlayer = () => {
            camera.follow(playerMovement.getEyePosition());
        };

        syncCameraToPlayer();

        const updateArcticArmsTransform = () => {
            if (!arcticArmsObj) return;

            const front = camera.getFront();
            const right = camera.getRight();
            const up = camera.getUp();
            const anchor = noclip ? camera.position : playerMovement.getEyePosition();

            const offsetForward = vec3.scale(front, 0.4);
            const offsetRight = vec3.scale(right, 0.2);
            const offsetUp = vec3.scale(up, -0.05);

            const finalPos = vec3.add(vec3.add(vec3.add(anchor, offsetForward), offsetRight), offsetUp);

            // Column-major translation matrix for WebGPU (model space -> world space)
            arcticArmsObj.modelMatrix = [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                finalPos[0], finalPos[1], finalPos[2], 1,
            ];
        };

        let noclip = false;
        let altPressed = false;
        let previousNoclip = false;

        const speedElement = document.getElementById('speed-display');
        const groundedElement = document.getElementById('grounded-display');

        scene.start((scene, deltaTime) => {
            const wasNoclip = previousNoclip;

            if (input.isKeyPressed('AltLeft')) {
                if (!altPressed) {
                    noclip = !noclip;
                    console.log(`Noclip: ${noclip ? 'ATIVADO' : 'DESATIVADO'}`);
                    altPressed = true;
                }
            } else {
                altPressed = false;
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
                
                let inputX = 0;
                let inputZ = 0;
                
                if (input.isKeyPressed('KeyW')) inputZ += 1;
                if (input.isKeyPressed('KeyS')) inputZ -= 1;
                if (input.isKeyPressed('KeyA')) inputX -= 1;
                if (input.isKeyPressed('KeyD')) inputX += 1;
                
                const jumpPressed = input.isKeyPressed('Space');
                
                playerMovement.update(deltaTime, inputX, inputZ, jumpPressed);
                syncCameraToPlayer();
                
                if (speedElement) {
                    const speed = playerMovement.getSpeed();
                    speedElement.textContent = `Speed: ${speed.toFixed(2)} u/s`;
                }
                if (groundedElement) {
                    groundedElement.textContent = `Grounded: ${playerMovement.getIsGrounded() ? 'Yes' : 'No'}`;
                }
            }

            updateArcticArmsTransform();

            previousNoclip = noclip;
        });

    } catch (error) {
        console.error("Falha ao iniciar a engine:", error);
    }
};

startGame();