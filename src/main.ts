import { mat4 } from 'gl-matrix';
import { Renderer } from './engine/Renderer';
import { Camera } from './engine/Camera';
// import { Input } from './engine/Input';
import { ObjLoader } from './loader/ObjLoader';
import { TextureLoader } from './loader/TextureLoader';

const canvas = document.getElementById('gfx-main') as HTMLCanvasElement;

const renderer = new Renderer(canvas);
const camera = new Camera(canvas.width / canvas.height);

const modelMatrix = mat4.create();

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
        mat4.rotateY(modelMatrix, modelMatrix, 0.01); 

        camera.updateProjection(canvas.width / canvas.height);
        const mvp = camera.getMatrix(modelMatrix);
        renderer.draw(mvp as Float32Array);

        requestAnimationFrame(frame);
        };

        console.log("Iniciando Loop de Renderização...");
        requestAnimationFrame(frame);

    } catch (error) {
        console.error("Falha ao iniciar a engine:", error);
    }
};

startGame();