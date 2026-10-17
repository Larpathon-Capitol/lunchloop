// Shared surface look for the 3D mascots: soft vinyl toys with a little gloss, so all three
// read as one family. Spread the result onto a material:
//   <meshPhysicalMaterial {...toy('#f4c27a')} />
import type { MeshPhysicalMaterialParameters } from 'three'

/** Plum-black for eyes, mouths and outlines. Matches --ink. */
export const TOY_INK = '#2b0f1d'
/** Blush and tongue pink. Matches --pink-4. */
export const TOY_BLUSH = '#ff8fab'

export function toy(color: string, opts: { gloss?: number; soft?: number } = {}): MeshPhysicalMaterialParameters {
  const gloss = opts.gloss ?? 0.35
  const soft = opts.soft ?? 0.5
  return {
    color,
    roughness: 0.62 - gloss * 0.4,
    metalness: 0,
    clearcoat: gloss,
    clearcoatRoughness: 0.35,
    sheen: soft,
    sheenRoughness: 0.6,
    sheenColor: '#ffffff',
  }
}

/** Wet-looking black for eyes. */
export function eyeGloss(): MeshPhysicalMaterialParameters {
  return { color: TOY_INK, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }
}
