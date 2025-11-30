import { mat4 } from './engine/Math';
import { Renderer } from './engine/Renderer';
import { Camera } from './engine/Camera';
import { Scene } from './engine/Scene';
// import { Input } from './engine/Input';

const canvas = document.getElementById('gfx-main') as HTMLCanvasElement;

const renderer = new Renderer(canvas);
const camera = new Camera(canvas.width / canvas.height);
const scene = new Scene(renderer, camera);

const startGame = async () => {
    try {
        await renderer.initialize();

        const arcticObj = await scene.loadObject(
            'src/assets/Arctic_T/Arctic_T.obj',
            'src/assets/Arctic_T/t_arctic.png'
        );

        if (!arcticObj) {
            throw new Error("Falha ao carregar o objeto Arctic_T");
        }

        scene.start((scene, deltaTime) => {
            if (arcticObj) {
                arcticObj.modelMatrix = mat4.yRotate(arcticObj.modelMatrix, 0.01);
            }
        });

    } catch (error) {
        console.error("Falha ao iniciar a engine:", error);
    }
};

startGame();