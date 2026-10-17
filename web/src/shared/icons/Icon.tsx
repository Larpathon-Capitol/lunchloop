import type { ReactNode, SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement> & { title?: string }

/* Shared frame for every icon: 24x24 grid, 1.75px round stroke, currentColor.
   Decorative by default; pass `title` to make it an announced image. */
export function Icon({ title, children, ...rest }: IconProps & { children: ReactNode }) {
  const a11y = title ? { role: 'img' as const } : { 'aria-hidden': true as const, focusable: false as const }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...a11y}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

/* Small solid accent dot, the only fill used in the set. */
export function Dot({ cx, cy, r = 1.15 }: { cx: number; cy: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
}
