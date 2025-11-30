import { mat4 } from './engine/Math';
import { Renderer } from './engine/Renderer';
import { Camera } from './engine/Camera';
import { Scene } from './engine/Scene';
import { Input } from './engine/Input';

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
            'src/assets/Bhop_Ray/Untitled.obj'
        );

        if (!mapObj) {
            console.warn("Falha ao carregar o mapa Bhop_Ray");
        }

        const arcticObj = await scene.loadObject(
            'src/assets/Arctic_T/Arctic_T.obj',
            'src/assets/Arctic_T/t_arctic.png'
        );

        if (!arcticObj) {
            throw new Error("Falha ao carregar o objeto Arctic_T");
        }

        camera.position = [0, 2, 5];

        const moveSpeed = 10;

        scene.start((scene, deltaTime) => {
            if (input.isKeyPressed('KeyW')) camera.move('FORWARD', moveSpeed * deltaTime);
            if (input.isKeyPressed('KeyS')) camera.move('BACKWARD', moveSpeed * deltaTime);
            if (input.isKeyPressed('KeyA')) camera.move('LEFT', moveSpeed * deltaTime);
            if (input.isKeyPressed('KeyD')) camera.move('RIGHT', moveSpeed * deltaTime);
            
            if (input.isKeyPressed('Space')) camera.move('UP', moveSpeed * deltaTime);
            if (input.isKeyPressed('LeftCtrl') || input.isKeyPressed('LeftCtrl')) camera.move('DOWN', moveSpeed * deltaTime);
            
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