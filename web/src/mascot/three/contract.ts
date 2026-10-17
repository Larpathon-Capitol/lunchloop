// The deal between the mascot rig and each 3D mascot model.
//
// The rig owns the canvas, lights, camera, where the mascot sits on screen, and every
// whole-body motion: hop, squash and stretch, tilt, breathing, turning to look, petting wobble.
// A model owns only its own shape and its face and parts (eyes, blinks, mouth, blush,
// arms or wing tips, accessory), driven every frame from the input below.
//
// Model space: the mascot stands on y = 0, centered on x = 0 and z = 0, faces +z (toward the
// camera), and is 1 unit tall (bounding box height 1, width at most 1.1, depth at most 0.8).
// The rig scales and moves the whole group; a model never moves its own root.
import type { MutableRefObject } from 'react'
import type { UmeMood } from '../types'

export interface RigInput {
  mood: UmeMood
  /** 0 to 1, smoothed: how much the mascot is being petted right now. */
  pet: number
  /** Where to look, -1 to 1 on each axis (x right, y up), smoothed. Eyes and head parts follow it. */
  look: { x: number; y: number }
  /** 0 open to 1 shut. The rig drives the blink timing; models close their eyes by this much. */
  blink: number
  /** 0 to 1 while a speech bubble is showing, for a little talking mouth. */
  talk: number
  /** Seconds since the rig started, for idle loops. */
  time: number
  /** 0 to 1 after a hop lands, decaying: models can flap or wiggle parts with it. */
  bounce: number
}

export interface MascotModelProps {
  /** Read it inside useFrame; the rig mutates it in place every frame. Never copy it into React state. */
  input: MutableRefObject<RigInput>
}
