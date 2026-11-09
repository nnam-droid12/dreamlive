import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  AssetManager,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SkinnedMesh,
} from '@iwsdk/core';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Party guests: Quaternius Universal Base Characters (CC0, simplified) animated
 * with the Universal Animation Library's moves (CC0), bound by bone name.
 * The base bodies have no clothes, so outfits are painted on in the shader
 * from the rest pose: sneakers, trousers or a dress, and a short-sleeved shirt;
 * head, forearms and hands keep the skin texture. Each guest gets its own
 * colours, move, tempo and phase.
 */
export interface Outfit {
  shirt: number;
  pants: number;
  shoes: number;
  /** A dress (knee to neck) instead of shirt and trousers. */
  dress: boolean;
}

export interface Guest {
  root: Object3D;
  mixer: AnimationMixer;
  action: AnimationAction;
  rate: number;
  /** Where the owner placed it (the dance bounce rides on top), and its own beat offset. */
  baseY?: number;
  phase: number;
}

/** Party moves: real dancing and jumping (no idles: everyone on the floor is dancing). */
const MOVES = ['Dance_Loop', 'Dance_Loop', 'Jump_Loop', 'Dance_Loop', 'Dance_Loop', 'Jump_Loop'];

/** Paint clothes on a skinned body by rest-pose position (metres; feet at 0, arms out along X). */
function dress(mat: MeshStandardMaterial, o: Outfit): void {
  const shirt = new Color(o.shirt);
  const pants = new Color(o.pants);
  const shoes = new Color(o.shoes);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uShirt = { value: shirt };
    shader.uniforms.uPants = { value: pants };
    shader.uniforms.uShoes = { value: shoes };
    shader.uniforms.uDress = { value: o.dress ? 1 : 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;\nuniform vec3 uShirt, uPants, uShoes;\nuniform float uDress;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          float y = vRest.y;
          float ax = abs(vRest.x);
          float cloth = 0.0;
          vec3 c = diffuseColor.rgb;
          if (y < 0.09) { c = uShoes; cloth = 1.0; }
          else if (uDress > 0.5) {
            if (y > 0.5 && y < 1.47 && ax < 0.3) { c = uShirt; cloth = 1.0; }
          } else {
            if (y < 0.98) { c = uPants; cloth = 1.0; }
            else if (y < 1.47 && ax < 0.32) { c = uShirt; cloth = 1.0; }
          }
          // A little fabric shading so clothes are not flat paint.
          float weave = 0.92 + 0.08 * sin(vRest.y * 220.0) * sin(vRest.x * 190.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, c * weave, cloth);
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'party-guest-outfit';
}

export class PartyGuests {
  readonly root = new Group();
  readonly guests: Guest[] = [];
  private clips = new Map<string, AnimationClip>();
  private clock = 0;

  /** Loads the two bodies and the moves, then makes `count` guests; resolves when ready. */
  async load(count: number, outfits: readonly number[], skin: readonly number[], pickMoves: readonly string[] = MOVES): Promise<void> {
    const base = `${import.meta.env.BASE_URL}models/people/`;
    const [male, female, moves] = await Promise.all(['male', 'female', 'moves'].map((n) => AssetManager.loadGLTF(`${base}${n}.glb`)));
    for (const c of moves.animations) this.clips.set(c.name, c);
    for (let i = 0; i < count; i++) {
      const src = i % 2 ? female.scene : male.scene;
      const body = cloneSkinned(src);
      const pick = (k: number) => outfits[(i * 5 + k * 3) % outfits.length];
      const outfit: Outfit = { shirt: pick(0), pants: pick(1), shoes: pick(2), dress: i % 2 === 1 && i % 3 === 0 };
      body.traverse((o) => {
        const m = o as SkinnedMesh;
        if (!m.isSkinnedMesh && !(o as Mesh).isMesh) return;
        m.frustumCulled = false;
        const mat = (m.material as MeshStandardMaterial).clone();
        // The body (the large mesh) wears the outfit and a skin tone; eyes and brows stay as they are.
        if (m.geometry.boundingBox === null) m.geometry.computeBoundingBox();
        const tall = (m.geometry.boundingBox?.max.y ?? 0) - (m.geometry.boundingBox?.min.y ?? 0) > 1;
        if (tall) {
          mat.color.setHex(skin[i % skin.length]);
          dress(mat, outfit);
        }
        m.material = mat;
      });
      const mixer = new AnimationMixer(body);
      const clip = this.clips.get(pickMoves[(i * 7) % pickMoves.length]) ?? this.clips.get('Dance_Loop');
      const action = mixer.clipAction(clip!);
      action.play();
      action.time = (i * 0.37) % (clip?.duration ?? 1);
      const rate = 0.9 + ((i * 0.53) % 1) * 0.25;
      this.guests.push({ root: body, mixer, action, rate, phase: (i * 0.731) % 1 });
      this.root.add(body);
    }
  }

  /** Advance the dance; `energy` 0..1 (party life) and `kick` (music) make them move a little harder. */
  update(delta: number, energy: number, kick: number, bounce = 1): void {
    const k = (0.75 + 0.45 * energy) * (1 + 0.15 * kick);
    this.clock += delta;
    for (const g of this.guests) {
      g.mixer.update(delta * g.rate * k);
      if (!bounce) continue;
      // On top of the move: a bounce on the beat (~120 bpm) and a sway, each guest a little off the others.
      g.baseY ??= g.root.position.y;
      const beat = (this.clock * 2 + g.phase) % 1;
      g.root.position.y = g.baseY + Math.abs(Math.sin(beat * Math.PI)) * 0.06 * bounce * (0.6 + energy * 0.4);
      g.root.rotation.z = Math.sin((this.clock + g.phase * 3) * Math.PI) * 0.06 * bounce;
    }
  }
}
