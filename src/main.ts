import { mat4 } from 'gl-matrix';
import { Renderer } from './engine/Renderer';
import { Camera } from './engine/Camera';

const canvas = document.getElementById('gfx-main') as HTMLCanvasElement;

const renderer = new Renderer(canvas);
const camera = new Camera(canvas.width / canvas.height);

// Variáveis de Estado do Jogo (Simples por enquanto)
const modelMatrix = mat4.create();

const startGame = async () => {
    try {
        await renderer.initialize();
        
        // Loop do Jogo
        const frame = () => {
            mat4.rotate(modelMatrix, modelMatrix, 0.01, [0.5, 1, 0]);

            // Sempre manter o aspect ratio do viewport atualizado
            camera.updateProjection(canvas.width / canvas.height);

            // 3. Obter projeção do modelo e desenhar
            const mvp = camera.getMatrix(modelMatrix);
            renderer.draw(mvp as Float32Array);

            requestAnimationFrame(frame);
        };

        requestAnimationFrame(frame);

    } catch (error) {
        console.error("Falha ao iniciar a engnie:", error);
    }
};

startGame();