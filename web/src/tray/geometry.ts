import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { GroupId } from './groups'

/*
 * Tray layout, in "plan" coordinates: x to the right, y away from the viewer, units are arbitrary
 * (the tray is 3.4 wide). Shapes are drawn in this plane and extruded along +z, then the whole
 * tray group is rotated -90 degrees about x so plan z becomes world up and plan y becomes world -z.
 */
export const TRAY = {
  width: 3.4,
  depth: 2.4,
  radius: 0.34,
  /** Height of the divider body (extrusion depth, before bevels). */
  body: 0.16,
  bevel: 0.03,
  /** Distance from the tray edge to the compartment openings. */
  margin: 0.24,
  /** Width of the raised rim, from the tray edge. */
  rim: 0.13,
  rimHeight: 0.05,
  /** Height of the compartment floors. */
  floor: 0.02,
} as const

export type Compartment =
  | { id: GroupId; kind: 'rect'; x: number; y: number; w: number; h: number; r: number }
  | { id: GroupId; kind: 'circle'; cx: number; cy: number; r: number }

const X0 = -TRAY.width / 2 + TRAY.margin
const X1 = TRAY.width / 2 - TRAY.margin
const Y0 = -TRAY.depth / 2 + TRAY.margin
const Y1 = TRAY.depth / 2 - TRAY.margin
const GAP = 0.12
const TOP_ROW = 0.78
const CUP = TOP_ROW / 2
const SPLIT_Y = Y1 - TOP_ROW
const SIDE_W = (X1 - TOP_ROW - GAP - X0 - GAP) / 2
const GRAINS_W = 1.2

/** Top row: fruit, vegetable, round milk well. Bottom row: grain and the wide main dish (meat_alternate) well. */
export const COMPARTMENTS: readonly Compartment[] = [
  { id: 'fruit', kind: 'rect', x: X0, y: SPLIT_Y, w: SIDE_W, h: TOP_ROW, r: 0.17 },
  { id: 'vegetable', kind: 'rect', x: X0 + SIDE_W + GAP, y: SPLIT_Y, w: SIDE_W, h: TOP_ROW, r: 0.17 },
  { id: 'milk', kind: 'circle', cx: X1 - CUP, cy: Y1 - CUP, r: CUP },
  { id: 'grain', kind: 'rect', x: X0, y: Y0, w: GRAINS_W, h: SPLIT_Y - GAP - Y0, r: 0.2 },
  {
    id: 'meat_alternate',
    kind: 'rect',
    x: X0 + GRAINS_W + GAP,
    y: Y0,
    w: X1 - X0 - GRAINS_W - GAP,
    h: SPLIT_Y - GAP - Y0,
    r: 0.2,
  },
]

/** Center of a compartment in plan coordinates. */
export function compartmentCenter(c: Compartment): [number, number] {
  return c.kind === 'circle' ? [c.cx, c.cy] : [c.x + c.w / 2, c.y + c.h / 2]
}

/** Usable floor size (width, depth) of a compartment, for placing food. */
export function compartmentSize(c: Compartment): [number, number] {
  return c.kind === 'circle' ? [c.r * 2, c.r * 2] : [c.w, c.h]
}

function roundedRect(path: THREE.Path, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  path.moveTo(x + rr, y)
  path.lineTo(x + w - rr, y)
  path.absarc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false)
  path.lineTo(x + w, y + h - rr)
  path.absarc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false)
  path.lineTo(x + rr, y + h)
  path.absarc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false)
  path.lineTo(x, y + rr)
  path.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false)
  return path
}

/** Compartment outline, grown (positive) or shrunk (negative) by `offset`. */
function compartmentPath<T extends THREE.Path>(path: T, c: Compartment, offset = 0): T {
  if (c.kind === 'circle') {
    path.absarc(c.cx, c.cy, c.r + offset, 0, Math.PI * 2, false)
  } else {
    roundedRect(path, c.x - offset, c.y - offset, c.w + offset * 2, c.h + offset * 2, c.r + offset)
  }
  return path
}

function outline(inset = 0) {
  const { width: w, depth: d, radius: r } = TRAY
  return roundedRect(new THREE.Shape(), -w / 2 + inset, -d / 2 + inset, w - inset * 2, d - inset * 2, r - inset) as THREE.Shape
}

/**
 * ExtrudeGeometry comes out non-indexed with flat face normals, which makes rounded corners look
 * faceted. Welding the vertices and recomputing normals gives smooth, polished-looking bevels.
 */
function smooth(geometry: THREE.BufferGeometry) {
  geometry.deleteAttribute('normal')
  geometry.deleteAttribute('uv')
  const welded = mergeVertices(geometry, 1e-4)
  geometry.dispose()
  welded.computeVertexNormals()
  // Flat caps must stay perfectly flat. Without this the cap edge picks up the bevel's tilt and the
  // long cap triangles smear it across the surface as visible streaks.
  welded.computeBoundingBox()
  const { min, max } = welded.boundingBox!
  const pos = welded.getAttribute('position')
  const nrm = welded.getAttribute('normal')
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i)
    if (Math.abs(z - max.z) < 1e-4) nrm.setXYZ(i, 0, 0, 1)
    else if (Math.abs(z - min.z) < 1e-4) nrm.setXYZ(i, 0, 0, -1)
  }
  nrm.needsUpdate = true
  return welded
}

const CURVE_SEGMENTS = 20

function extrude(shape: THREE.Shape, depth: number, bevel: number) {
  return smooth(
    new THREE.ExtrudeGeometry(shape, {
      depth,
      curveSegments: CURVE_SEGMENTS,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 4,
    }),
  )
}

export interface TrayGeometries {
  body: THREE.BufferGeometry
  rim: THREE.BufferGeometry
  base: THREE.BufferGeometry
  /** Per compartment: the flat floor area (for tint and hit testing) and a thin outline ring on the floor. */
  wells: Record<GroupId, { floor: THREE.BufferGeometry; ring: THREE.BufferGeometry; opening: THREE.BufferGeometry }>
}

export function buildTrayGeometries(): TrayGeometries {
  const { bevel } = TRAY

  // Divider body: the tray outline with every compartment punched through. Its bevel rounds the
  // lip of each opening.
  const bodyShape = outline()
  for (const c of COMPARTMENTS) bodyShape.holes.push(compartmentPath(new THREE.Path(), c))
  const body = extrude(bodyShape, TRAY.body, bevel)

  // Raised rim: a ring sitting on top of the body, sharing its outer edge.
  const rimShape = outline()
  rimShape.holes.push(outline(TRAY.rim) as THREE.Path)
  const rim = extrude(rimShape, TRAY.rimHeight, bevel)
  rim.translate(0, 0, TRAY.body)

  // Solid base under the body; its top face is the compartment floor.
  const baseDepth = 0.05
  const base = extrude(outline(0.06), baseDepth, 0.015)
  base.translate(0, 0, TRAY.floor - baseDepth - 0.015)

  const wells = {} as TrayGeometries['wells']
  for (const c of COMPARTMENTS) {
    // The body bevel narrows each opening by `bevel` at the floor.
    const floorShape = compartmentPath(new THREE.Shape(), c, -bevel - 0.004)
    const ringShape = compartmentPath(new THREE.Shape(), c, -bevel - 0.004)
    ringShape.holes.push(compartmentPath(new THREE.Path(), c, -bevel - 0.05))
    wells[c.id] = {
      floor: new THREE.ShapeGeometry(floorShape, CURVE_SEGMENTS),
      ring: new THREE.ShapeGeometry(ringShape, CURVE_SEGMENTS),
      opening: new THREE.ShapeGeometry(compartmentPath(new THREE.Shape(), c), 8),
    }
  }

  return { body, rim, base, wells }
}

export function disposeTrayGeometries(g: TrayGeometries) {
  g.body.dispose()
  g.rim.dispose()
  g.base.dispose()
  for (const w of Object.values(g.wells)) {
    w.floor.dispose()
    w.ring.dispose()
    w.opening.dispose()
  }
}
