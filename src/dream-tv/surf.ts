/**
 * Surf act: Bigfoot rides a shortboard across a moonlit sea in front of the New
 * York skyline, a breaking wave curling behind him. The sea moves in the vertex
 * shader (no per-frame CPU work); foam and spray are point sprites.
 */
import { Color, DoubleSide, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Shape, Texture } from '@iwsdk/core';
import { buildSurfboard } from '../scene-assets/surfboard.scene-asset.js';
import { baseScene, DreamTvScene, sparkles } from './common.js';

/** A standard material whose vertices swell into rolling swells (time uniform). */
function seaMaterial(time: { value: number }): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: 0x1f5fa8, roughness: 0.12, metalness: 0.15, emissive: new Color(0x06204a), emissiveIntensity: 0.5 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nfloat swell(vec2 p){return sin(p.x*0.55+uTime*1.5)*0.16+sin(p.y*0.8-uTime*1.1)*0.12+sin((p.x+p.y)*1.7+uTime*2.3)*0.04;}')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.z += swell(position.xy);')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        { vec2 p = position.xy; float e = 0.05;
          float dx = swell(p + vec2(e, 0.0)) - swell(p - vec2(e, 0.0));
          float dy = swell(p + vec2(0.0, e)) - swell(p - vec2(0.0, e));
          objectNormal = normalize(vec3(-dx / (2.0 * e), -dy / (2.0 * e), 1.0)); }`);
  };
  return m;
}

/** Cross-section of a breaking wave (y up, z toward the viewer), extruded along x. */
function waveGeometry(length: number): ExtrudeGeometry {
  const s = new Shape();
  s.moveTo(-3.2, -0.2);
  s.bezierCurveTo(-2.2, 0.2, -1.2, 1.6, -0.4, 2.3);
  s.bezierCurveTo(0.1, 2.7, 0.8, 2.6, 1.0, 2.1);
  s.bezierCurveTo(1.1, 1.8, 0.8, 1.6, 0.55, 1.75);
  s.bezierCurveTo(0.4, 1.4, 0.0, 0.6, 0.6, -0.2);
  s.lineTo(-3.2, -0.2);
  const g = new ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments: 16 });
  g.translate(0, 0, -length / 2);
  // Shape +x (the curling lip) faces the viewer (+Z); the extrusion runs along X.
  g.rotateY(-Math.PI / 2);
  return g;
}

export function surfScene(skyline: Texture | null): DreamTvScene {
  const scene = baseScene(['#101c48', '#4f6fb8'], skyline, 2.2);
  const time = { value: 0 };
  const seaGeo = new PlaneGeometry(60, 60, 64, 64);
  const sea = new Mesh(seaGeo, seaMaterial(time));
  sea.rotation.x = -Math.PI / 2;
  scene.add(sea);

  const wave = new Mesh(
    waveGeometry(22),
    new MeshStandardMaterial({ color: 0x2f8fd8, roughness: 0.2, metalness: 0.1, emissive: new Color(0x0a4a8a), emissiveIntensity: 0.55, side: DoubleSide }),
  );
  wave.name = 'Wave';
  // Far enough back and low enough that the skyline still shows above the curl.
  wave.scale.set(1, 0.6, 0.9);
  wave.position.set(0, -0.05, -6.5);
  const foam = sparkles(420, 0.08, 0xf4fbff, [22, 0.35, 0.6], [0, 1.5, -6.0]);
  const lip = sparkles(220, 0.06, 0xdff4ff, [22, 0.9, 0.4], [0, 1.0, -5.7]);
  scene.add(wave, foam, lip);

  const rider = new Group();
  const board = buildSurfboard();
  board.scale.setScalar(0.95);
  const slot = new Group();
  slot.position.y = 0.04;
  rider.add(board, slot);
  const spray = sparkles(160, 0.06, 0xffffff, [1.6, 0.6, 0.8], [-1.0, 0.3, 0]);
  rider.add(spray);
  scene.add(rider);

  return {
    key: 'surf', scene, slot, eye: [0, 1.55, 3.8], target: [0, 1.05, -0.2], pose: 'idle',
    update(t) {
      time.value = t;
      const swayX = Math.sin(t * 0.6) * 0.9;
      rider.position.set(swayX, 0.18 + Math.sin(t * 1.5) * 0.08, Math.sin(t * 1.2) * 0.25);
      rider.rotation.set(Math.sin(t * 1.5) * 0.06, Math.cos(t * 0.6) * 0.35, Math.sin(t * 1.2) * 0.1);
      foam.position.x = Math.sin(t * 0.8) * 0.3;
      lip.position.y = Math.sin(t * 2) * 0.05;
      spray.rotation.y = t * 1.5;
      spray.scale.setScalar(0.8 + Math.abs(Math.sin(t * 1.5)) * 0.4);
    },
  };
}
