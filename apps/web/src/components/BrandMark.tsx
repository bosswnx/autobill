import favicon from '../assets/brand/favicon.svg'

export function BrandMark({ className }: { className?: string }) {
  return <img src={favicon} alt="" aria-hidden className={className} />
}
