export interface Material {
    name: string;
    diffuseMap?: string;  // map_Kd - caminho da textura diffuse
    diffuseColor?: number[]; // Kd - cor diffuse (se não tiver textura)
    specularColor?: number[]; // Ks
    ambientColor?: number[]; // Ka
    shininess?: number; // Ns
    opacity?: number; // d
}

export class MtlLoader {
    static async load(url: string): Promise<Map<string, Material>> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`Não foi possível carregar MTL: ${url}`);
                return new Map();
            }
            const text = await response.text();
            return this.parse(text, url);
        } catch (error) {
            console.warn(`Erro ao carregar MTL: ${url}`, error);
            return new Map();
        }
    }

    static parse(text: string, mtlUrl: string): Map<string, Material> {
        const materials = new Map<string, Material>();
        let currentMaterial: Material | null = null;

        const baseDir = mtlUrl.substring(0, mtlUrl.lastIndexOf('/') + 1);

        const lines = text.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length === 0 || trimmed.startsWith('#')) continue;

            const parts = trimmed.split(/\s+/);
            const keyword = parts[0];

            switch (keyword) {
                case 'newmtl':
                    if (currentMaterial) {
                        materials.set(currentMaterial.name, currentMaterial);
                    }
                    currentMaterial = {
                        name: parts.slice(1).join(' ')
                    };
                    break;

                case 'map_Kd':
                    if (currentMaterial) {
                        let texturePath = parts.slice(1).join(' ');

                        if (texturePath.match(/^[A-Za-z]:\//)) {
                            const fileName = texturePath.substring(texturePath.lastIndexOf('/') + 1);
                            texturePath = baseDir + 'textures/' + fileName;
                        } else if (!texturePath.startsWith('http') && !texturePath.startsWith('/')) {
                            texturePath = baseDir + texturePath;
                        }
                        
                        currentMaterial.diffuseMap = texturePath;
                    }
                    break;

                case 'Kd':
                    if (currentMaterial) {
                        currentMaterial.diffuseColor = [
                            parseFloat(parts[1] || '0.8'),
                            parseFloat(parts[2] || '0.8'),
                            parseFloat(parts[3] || '0.8')
                        ];
                    }
                    break;

                case 'Ks':
                    if (currentMaterial) {
                        currentMaterial.specularColor = [
                            parseFloat(parts[1] || '0'),
                            parseFloat(parts[2] || '0'),
                            parseFloat(parts[3] || '0')
                        ];
                    }
                    break;

                case 'Ka':
                    if (currentMaterial) {
                        currentMaterial.ambientColor = [
                            parseFloat(parts[1] || '0'),
                            parseFloat(parts[2] || '0'),
                            parseFloat(parts[3] || '0')
                        ];
                    }
                    break;

                case 'Ns':
                    if (currentMaterial) {
                        currentMaterial.shininess = parseFloat(parts[1] || '0');
                    }
                    break;

                case 'd':
                    if (currentMaterial) {
                        currentMaterial.opacity = parseFloat(parts[1] || '1');
                    }
                    break;
            }
        }

        if (currentMaterial) {
            materials.set(currentMaterial.name, currentMaterial);
        }

        return materials;
    }
}
