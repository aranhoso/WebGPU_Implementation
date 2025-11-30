import { mat4 } from './engine/Math';
import { Renderer } from './engine/Renderer';
import { Camera } from './engine/Camera';
import { Scene } from './engine/Scene';
// import { Input } from './engine/Input';

const canvas = document.getElementById('gfx-main') as HTMLCanvasElement;

const renderer = new Renderer(canvas);
const camera = new Camera(canvas.width / canvas.height);
const scene = new Scene(renderer, camera);

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

        // Carrega o mapa com suporte a múltiplos materiais
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

        const orbitTarget = [0, 1, 0];

        camera.position = [0, 2, 5];
        camera.lookAt(orbitTarget);

        scene.start((scene, deltaTime) => {
            camera.orbit(orbitTarget, 0.005);
        });

    } catch (error) {
        console.error("Falha ao iniciar a engine:", error);
    }
};

startGame();