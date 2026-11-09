import { AssetManager, Color, FrontSide, Group, Matrix4, MeshStandardMaterial, Object3D, SkinnedMesh } from '@iwsdk/core';

const JOINTS: XRHandJoint[] = [
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
    for (const side of ['left', 'right'] as const) {
      const gltf = await AssetManager.loadGLTF(`${base}${side}.glb`);
      const s = this.sides[side];
      const scene = gltf.scene;
      scene.traverse((o) => {
        const mesh = o as SkinnedMesh;
        if (mesh.isSkinnedMesh) {
          mesh.material = mat;
          mesh.frustumCulled = false;
          mesh.renderOrder = 5;
        }
      });
      s.bones = JOINTS.map((j) => scene.getObjectByName(j) ?? undefined);
      s.root.add(scene);
    }
    this.ready = true;
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

/** Milky translucent skin with a glassy, slightly blue rim (the look of Meta's hands). */
function handMaterial(): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({
    color: new Color(0xf2f4f8),
    roughness: 0.35,
    metalness: 0,
    transparent: true,
    opacity: 0.6,
    depthWrite: true,
    side: FrontSide,
  });
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rim = pow(1.0 - clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0), 2.2);
        totalEmissiveRadiance += vec3(0.62, 0.72, 0.95) * rim * 0.9 + vec3(0.1);`,
      )
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.a = clamp(0.42 + rim * 0.55, 0.0, 1.0);');
  };
  return mat;
}
