declare module 'three/examples/jsm/misc/GPUComputationRenderer' {
    import { WebGLRenderer, RenderTarget, Texture, ShaderMaterial, DataTexture } from 'three';

    export class GPUComputationRenderer {
        constructor(sizeX: number, sizeY: number, renderer: WebGLRenderer);
        addVariable(variableName: string, computeFragmentShader: string, initialValueTexture: Texture): any;
        setVariableDependencies(variable: any, dependencies: any[] | null): void;
        init(): string | null;
        compute(): void;
        getCurrentRenderTarget(variable: any): RenderTarget;
        getAlternateRenderTarget(variable: any): RenderTarget;
        createTexture(): DataTexture;
        renderTexture(input: Texture, output: Texture): void;
    }
}

declare module 'three/examples/jsm/math/MeshSurfaceSampler' {
    import { Mesh, Vector3, Color } from 'three';

    export class MeshSurfaceSampler {
        constructor(mesh: Mesh);
        setWeightAttribute(name: string | null): this;
        build(): this;
        sample(targetPosition: Vector3, targetNormal?: Vector3, targetColor?: Color): this;
    }
}