import { mat4 } from './engine/Math';
import { Renderer } from './engine/Renderer';
import { Camera } from './engine/Camera';
import { Scene } from './engine/Scene';
import { Input } from './engine/Input';
import { CollisionSystem } from './engine/Collision';

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

        camera.position = [-24, 10, 19]; // x y z

        const moveSpeed = 10;
        let noclip = false;
        let altPressed = false;

        const moveWithCollision = (direction: 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN', speed: number) => {
            const oldPos = [...camera.position];
            const newPos = camera.tryMove(direction, speed);
            const resolvedPos = collision.resolveCollision(oldPos, newPos);
            camera.setPosition(resolvedPos);
        };

        const moveWithoutCollision = (direction: 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN', speed: number) => {
            camera.move(direction, speed);
        };

        scene.start((scene, deltaTime) => {
            if (input.isKeyPressed('AltLeft')) {
                if (!altPressed) {
                    noclip = !noclip;
                    console.log(`Noclip: ${noclip ? 'ATIVADO' : 'DESATIVADO'}`);
                    altPressed = true;
                }
            } else {
                altPressed = false;
            }

            const moveFunc = noclip ? moveWithoutCollision : moveWithCollision;

            if (input.isKeyPressed('KeyW')) moveFunc('FORWARD', moveSpeed * deltaTime);
            if (input.isKeyPressed('KeyS')) moveFunc('BACKWARD', moveSpeed * deltaTime);
            if (input.isKeyPressed('KeyA')) moveFunc('LEFT', moveSpeed * deltaTime);
            if (input.isKeyPressed('KeyD')) moveFunc('RIGHT', moveSpeed * deltaTime);
            
            if (input.isKeyPressed('Space')) moveFunc('UP', moveSpeed * deltaTime);
            if (input.isKeyPressed('ControlLeft') || input.isKeyPressed('ControlRight')) moveFunc('DOWN', moveSpeed * deltaTime);
            
            if (input.isLocked()) {
                const mouseDelta = input.getMouseDelta();
                camera.updateRotation(mouseDelta.x, mouseDelta.y);
            }
        });

    } catch (error) {
        console.error("Falha ao iniciar a engine:", error);
    }
};

startGame();