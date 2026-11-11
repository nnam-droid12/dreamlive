import { Palette } from '../config/palette.js';
import { AssetManager, BackSide, Color, CylinderGeometry, FrontSide, Group, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion, ShaderMaterial, SkinnedMesh, Vector3 } from '@iwsdk/core';

export const JOINTS: XRHandJoint[] = [
  'wrist',
  'thumb-metacarpal',
  'thumb-phalanx-proximal',
  'thumb-phalanx-distal',
  'thumb-tip',
  'index-finger-metacarpal',
  'index-finger-phalanx-proximal',
  'index-finger-phalanx-intermediate',
  'index-finger-phalanx-distal',
  'index-finger-tip',
  'middle-finger-metacarpal',
  'middle-finger-phalanx-proximal',
  'middle-finger-phalanx-intermediate',
  'middle-finger-phalanx-distal',
  'middle-finger-tip',
  'ring-finger-metacarpal',
  'ring-finger-phalanx-proximal',
  'ring-finger-phalanx-intermediate',
  'ring-finger-phalanx-distal',
  'ring-finger-tip',
  'pinky-finger-metacarpal',
  'pinky-finger-phalanx-proximal',
  'pinky-finger-phalanx-intermediate',
  'pinky-finger-phalanx-distal',
  'pinky-finger-tip',
];

/** The slice of the emulator's (IWER) hand the trailer reads. */
export interface EmulatedHand {
  connected: boolean;
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
  inputSource?: { hand?: { get(j: string): object | undefined } };
}

const V = new Vector3();
const Q = new Quaternion();
const ONE = new Vector3(1, 1, 1);

/** IWER keeps a joint's pose (relative to the hand's target ray) in a symbol-keyed field. */
export function jointOffset(js: object): ArrayLike<number> | undefined {
  for (const k of Object.getOwnPropertySymbols(js)) {
    const v = (js as Record<symbol, { offsetMatrix?: ArrayLike<number> } | undefined>)[k];
    if (v?.offsetMatrix) return v.offsetMatrix;
  }
  return undefined;
}

type FillPosesFrame = XRFrame & { fillPoses?: (spaces: XRSpace[], base: XRSpace, out: Float32Array) => boolean };

interface Side {
  root: Group;
  bones: (Object3D | undefined)[];
  spaces?: XRJointSpace[];
  hand?: XRHand;
}

/**
 * Life-size, fully articulated hands for captures (Director renders): the
 * WebXR generic hand mesh (public/models/hands, MIT) skinned to the tracked
 * hand's 25 joints every frame, in a Meta-style look: a soft, milky,
 * translucent skin with a bright glassy rim. (IWSDK's own hand visual loads
 * its model from a CDN, which an offline emulator capture cannot rely on.)
 */
export class RealHands {
  readonly root = new Group();
  private sides: Record<'left' | 'right', Side> = {
    left: { root: new Group(), bones: [] },
    right: { root: new Group(), bones: [] },
  };
  private poses = new Float32Array(JOINTS.length * 16);
  private m = new Matrix4();
  private base = new Matrix4();
  private ready = false;

  constructor() {
    this.root.name = 'RealHands';
    this.sides.left.root.name = 'RealHandLeft';
    this.sides.right.root.name = 'RealHandRight';
    this.root.add(this.sides.left.root, this.sides.right.root);
    this.root.visible = false;
  }

  async load(): Promise<void> {
    const base = `${import.meta.env.BASE_URL}models/hands/`;
    const mat = handMaterial();
    const line = outlineMaterial(true);
    const arm = forearmMaterial();
    const armLine = outlineMaterial(false);
    const outlines: SkinnedMesh[] = [];
    for (const side of ['left', 'right'] as const) {
      const gltf = await AssetManager.loadGLTF(`${base}${side}.glb`);
      const s = this.sides[side];
      const scene = gltf.scene;
      scene.traverse((o) => {
        const mesh = o as SkinnedMesh;
        if (mesh.isSkinnedMesh) {
          mesh.material = mat;
          mesh.frustumCulled = false;
          // The body draws first and writes depth, so the outline shell only shows past its silhouette.
          mesh.renderOrder = 4;
          outlines.push(mesh);
        }
      });
      // A crisp white outline: a slightly fattened copy on the same skeleton, drawn back faces only.
      for (const mesh of outlines) {
        const o = new SkinnedMesh(mesh.geometry, line);
        o.bind(mesh.skeleton, mesh.bindMatrix);
        o.frustumCulled = false;
        o.renderOrder = 5;
        mesh.parent?.add(o);
      }
      outlines.length = 0;
      s.bones = JOINTS.map((j) => scene.getObjectByName(j) ?? undefined);
      // The forearm: the hand continues into the arm (fading out toward the elbow).
      const wrist = s.bones[0];
      if (wrist) wrist.add(buildForearm(arm, armLine));
      s.root.add(scene);
    }
    this.ready = true;
  }

  /**
   * Follow the emulator's hands directly (Director renders): each joint's matrix
   * relative to the hand's target ray, on top of the hand's pose in rig space.
   */
  updateFromEmulator(hands: { left?: EmulatedHand; right?: EmulatedHand } | undefined, rig: Object3D): void {
    this.root.visible = false;
    if (!this.ready || !hands) return;
    rig.updateMatrixWorld();
    rig.matrixWorld.decompose(this.root.position, this.root.quaternion, this.root.scale);
    let any = false;
    for (const side of ['left', 'right'] as const) {
      const h = hands[side];
      const s = this.sides[side];
      s.root.visible = false;
      if (!h?.connected || !h.inputSource?.hand) continue;
      this.base.compose(V.set(h.position.x, h.position.y, h.position.z), Q.set(h.quaternion.x, h.quaternion.y, h.quaternion.z, h.quaternion.w), ONE);
      let ok = true;
      for (let i = 0; i < JOINTS.length; i++) {
        const bone = s.bones[i];
        const js = h.inputSource.hand.get(JOINTS[i]);
        const off = js && jointOffset(js);
        if (!bone || !off) {
          ok = false;
          continue;
        }
        this.m.fromArray(off).premultiply(this.base);
        this.m.decompose(bone.position, bone.quaternion, bone.scale);
      }
      s.root.visible = ok;
      any ||= ok;
    }
    this.root.visible = any;
  }

  /** Follow the tracked hands this frame: joint poses in the reference space, the rig's world matrix on top. */
  update(frame: XRFrame | undefined, ref: XRReferenceSpace | null | undefined, rig: Object3D): void {
    const f = frame as FillPosesFrame | undefined;
    this.root.visible = false;
    if (!this.ready || !f?.fillPoses || !ref) return;
    rig.updateMatrixWorld();
    rig.matrixWorld.decompose(this.root.position, this.root.quaternion, this.root.scale);
    let any = false;
    for (const src of f.session.inputSources) {
      if (!src.hand || (src.handedness !== 'left' && src.handedness !== 'right')) continue;
      const s = this.sides[src.handedness];
      if (s.hand !== src.hand) {
        const hand = src.hand;
        s.hand = hand;
        s.spaces = JOINTS.map((j) => hand.get(j)).filter((x): x is XRJointSpace => !!x);
      }
      if (!s.spaces || s.spaces.length !== JOINTS.length || !f.fillPoses(s.spaces, ref, this.poses)) {
        s.root.visible = false;
        continue;
      }
      for (let i = 0; i < JOINTS.length; i++) {
        const bone = s.bones[i];
        if (!bone) continue;
        this.m.fromArray(this.poses, i * 16);
        this.m.decompose(bone.position, bone.quaternion, bone.scale);
      }
      s.root.visible = true;
      any = true;
    }
    this.root.visible = any;
  }
}

/**
 * See-through smoky grey glass with a white outline (the DreamSpace / Quest
 * system-hand look). Unlit: the room's lights do not darken it, so it reads the
 * same against a bright wall or the night sky.
 */
function handMaterial(): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({
    color: new Color(0x000000),
    emissive: new Color(Palette.handGlass),
    roughness: 0.9,
    envMapIntensity: 0,
    metalness: 0,
    transparent: true,
    opacity: 0.35,
    depthWrite: true,
    side: FrontSide,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: new Color(Palette.handRim) };
    shader.fragmentShader = 'uniform vec3 uRimColor;' + String.fromCharCode(10) + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        // A soft lighter band toward each finger's edge (so fingers read over the palm); the white line is the outline shell.
        float rim = pow(1.0 - clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0), 2.5);
        totalEmissiveRadiance = mix(totalEmissiveRadiance, uRimColor, smoothstep(0.35, 0.95, rim) * 0.55);`,
      )
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.a = clamp(0.5 + rim * 0.4, 0.0, 0.92);');
  };
  return mat;
}

const OUTLINE = 0.0032;

/** The outline shell: back faces only, pushed out along the normals, plain white (skinned or not). */
function outlineMaterial(skinned: boolean): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ color: new Color(Palette.handRim), side: BackSide, transparent: true, opacity: 1, depthWrite: false });
  m.onBeforeCompile = (shader) => {
    const anchor = skinned ? '#include <skinning_vertex>' : '#include <begin_vertex>';
    const n = skinned ? 'objectNormal' : 'normal';
    // (On its own line: the chunk ends with an #endif.)
    shader.vertexShader = shader.vertexShader.replace(anchor, anchor + String.fromCharCode(10) + 'transformed += normalize(' + n + ') * ' + OUTLINE.toFixed(4) + ';');
    if (!skinned) {
      // The forearm's shell fades out with the arm.
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>' + String.fromCharCode(10) + 'varying float vFade;').replace('#include <begin_vertex>', '#include <begin_vertex>' + String.fromCharCode(10) + 'vFade = uv.y;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>' + String.fromCharCode(10) + 'varying float vFade;').replace('#include <dithering_fragment>', '#include <dithering_fragment>' + String.fromCharCode(10) + 'gl_FragColor.a *= smoothstep(0.35, 0.95, vFade);');
    }
  };
  return m;
}

/** The forearm's body: the hands' dark glass with a white edge, fading toward the elbow. */
function forearmMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uBody: { value: new Color(Palette.handGlass) }, uRim: { value: new Color(Palette.handRim) } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying float vFade;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vFade = uv.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody;
      uniform vec3 uRim;
      varying vec3 vN;
      varying vec3 vV;
      varying float vFade;
      void main() {
        float rim = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.5);
        vec3 c = mix(uBody, uRim, smoothstep(0.35, 0.95, rim) * 0.55);
        float a = clamp(0.5 + rim * 0.4, 0.0, 0.92) * smoothstep(0.35, 0.95, vFade);
        gl_FragColor = vec4(c, a);
      }`,
    transparent: true,
    depthWrite: true,
  });
}

/**
 * A tapered forearm from the wrist joint back toward the elbow (+Z in the
 * joint's frame: a hand joint's -Z points along the bones to the fingers).
 * uv.y runs 1 at the wrist to 0 at the far end, for the fade.
 */
function buildForearm(body: ShaderMaterial, line: MeshBasicMaterial): Group {
  const g = new Group();
  g.name = 'Forearm';
  const len = 0.22;
  // CylinderGeometry runs along Y with uv.y = 1 at the top: the top is the wrist end.
  const geo = new CylinderGeometry(0.022, 0.028, len, 28, 1, true);
  geo.translate(0, -len / 2 + 0.01, 0);
  geo.rotateX(-Math.PI / 2);
  const arm = new Mesh(geo, body);
  arm.renderOrder = 4;
  arm.frustumCulled = false;
  // Flatter like a real wrist: wider across than deep.
  arm.scale.set(1.12, 0.9, 1);
  const shell = new Mesh(geo, line);
  shell.renderOrder = 5;
  shell.frustumCulled = false;
  shell.scale.copy(arm.scale);
  g.add(shell, arm);
  return g;
}
