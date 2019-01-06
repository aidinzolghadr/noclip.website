
// Elebits

import * as Viewer from '../viewer';
import * as UI from '../ui';
import * as BRRES from './brres';
import * as U8 from './u8';

import { assert, leftPad } from '../util';
import { fetchData } from '../fetch';
import Progressable from '../Progressable';
import ArrayBufferSlice from '../ArrayBufferSlice';
import { RenderState } from '../render';
import { RRESTextureHolder, MDL0Model, MDL0ModelInstance } from './render';
import { GXMaterialHacks } from '../gx/gx_material';
import AnimationController from '../AnimationController';

const materialHacks: GXMaterialHacks = {
    colorLightingFudge: (p) => `${p.matSource}`,
    alphaLightingFudge: (p) => '1.0',
};

export class BasicRRESScene implements Viewer.MainScene {
    public textureHolder: RRESTextureHolder;
    public models: MDL0ModelInstance[] = [];
    public animationController: AnimationController;

    constructor(gl: WebGL2RenderingContext, public stageRRESes: BRRES.RRES[]) {
        this.textureHolder = new RRESTextureHolder();
        this.animationController = new AnimationController();

        for (let i = 0; i < stageRRESes.length; i++) {
            const stageRRES = stageRRESes[i];
            this.textureHolder.addRRESTextures(gl, stageRRES);
            assert(stageRRES.mdl0.length >= 1);

            const model = new MDL0Model(gl, stageRRES.mdl0[0], materialHacks);
            const modelRenderer = new MDL0ModelInstance(gl, this.textureHolder, model);
            this.models.push(modelRenderer);

            modelRenderer.bindRRESAnimations(this.animationController, stageRRES);
        }
    }

    public createPanels(): UI.Panel[] {
        const panels: UI.Panel[] = [];

        if (this.models.length > 1) {
            const layersPanel = new UI.LayerPanel();
            layersPanel.setLayers(this.models);
            panels.push(layersPanel);
        }

        return panels;
    }

    public destroy(gl: WebGL2RenderingContext): void {
        this.textureHolder.destroy(gl);
        this.models.forEach((model) => model.destroy(gl));
    }

    public render(state: RenderState): void {
        this.animationController.updateTime(state.time);

        this.models.forEach((model) => {
            model.render(state);
        });
    }
}

function makeElbPath(stg: string, room: number): string {
    let z = leftPad(''+room, 2);
    return `data/elb/${stg}_${z}_disp01.brres`;
}

class ElebitsSceneDesc implements Viewer.SceneDesc {
    constructor(public id: string, public name: string, public rooms: number[]) {}

    public createScene(gl: WebGL2RenderingContext): Progressable<Viewer.MainScene> {
        const paths = this.rooms.map((room) => makeElbPath(this.id, room));
        const progressables: Progressable<ArrayBufferSlice>[] = paths.map((path) => fetchData(path));
        return Progressable.all(progressables).then((buffers: ArrayBufferSlice[]) => {
            const stageRRESes = buffers.map((buffer) => BRRES.parse(buffer));
            return new BasicRRESScene(gl, stageRRESes);
        });
    }
}

export function createBasicRRESSceneFromBuffer(gl: WebGL2RenderingContext, buffer: ArrayBufferSlice): BasicRRESScene {
    const stageRRES = BRRES.parse(buffer);
    return new BasicRRESScene(gl, [stageRRES]);
}

export function createBasicRRESSceneFromU8Buffer(gl: WebGL2RenderingContext, buffer: ArrayBufferSlice): BasicRRESScene {
    const u8 = U8.parse(buffer);

    function findRRES(rres: BRRES.RRES[], dir: U8.U8Dir) {
        for (let i = 0; i < dir.files.length; i++)
            if (dir.files[i].name.endsWith('.brres'))
                rres.push(BRRES.parse(dir.files[i].buffer));
        for (let i = 0; i < dir.subdirs.length; i++)
            findRRES(rres, dir.subdirs[i]);
    }

    const rres: BRRES.RRES[] = [];
    findRRES(rres, u8.root);

    return new BasicRRESScene(gl, rres);
}

function range(start: number, count: number): number[] {
    const L: number[] = [];
    for (let i = start; i < start + count; i++)
        L.push(i);
    return L;
}

const id = "elb";
const name = "Elebits";
const sceneDescs: Viewer.SceneDesc[] = [
    new ElebitsSceneDesc("stg01", "Mom and Dad's House", range(1, 18)),
    new ElebitsSceneDesc("stg03", "The Town", [1]),
    new ElebitsSceneDesc("stg02", "Amusement Park - Main Hub", [1, 5]),
    new ElebitsSceneDesc("stg02", "Amusement Park - Castle", [2]),
    new ElebitsSceneDesc("stg02", "Amusement Park - Entrance", [3, 6]),
    new ElebitsSceneDesc("stg02", "Amusement Park - Space", [4]),
    new ElebitsSceneDesc("stg04", "Tutorial", [1, 2]),
];

export const sceneGroup: Viewer.SceneGroup = { id, name, sceneDescs };
