import { mat4 } from './engine/Math';
import { Renderer } from './engine/Renderer';
import { Camera } from './engine/Camera';
// import { Input } from './engine/Input';
import { ObjLoader } from './loader/ObjLoader';
import { TextureLoader } from './loader/TextureLoader';

const canvas = document.getElementById('gfx-main') as HTMLCanvasElement;

const renderer = new Renderer(canvas);
const camera = new Camera(canvas.width / canvas.height);

let modelMatrix = mat4.identity();

const startGame = async () => {
    try {
        await renderer.initialize();

        const meshPromise = ObjLoader.load('src/assets/Arctic_T/Arctic_T.obj');
        const texturePromise = TextureLoader.load(renderer.device, 'src/assets/Arctic_T/t_arctic.png');

        const [mesh, texture] = await Promise.all([meshPromise, texturePromise]);

        if (mesh) {
            console.log("Mesh carregada.");
            await renderer.setMesh(mesh);
        }
        
        if (texture) {
            console.log("Textura carregada.");
            renderer.setTexture(texture);
        }

        const frame = () => {
            modelMatrix = mat4.yRotate(modelMatrix, 0.01); 

            camera.updateProjection(canvas.width / canvas.height);
            const mvp = camera.getMatrix(modelMatrix);
            renderer.draw(new Float32Array(mvp));

            requestAnimationFrame(frame);
        };

        console.log("Iniciando Loop de Renderização...");
        requestAnimationFrame(frame);

    } catch (error) {
        console.error("Falha ao iniciar a engine:", error);
    }
};

startGame();