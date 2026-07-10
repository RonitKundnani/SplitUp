/** Teal rounded-square "S" brand mark used on the auth screens and nav. */
export default function BrandMark({ size = 64 }: { size?: number }) {
  return (
    <div
      className="mx-auto flex items-center justify-center rounded-2xl bg-brand-500 font-black text-white shadow-sm"
      style={{ height: size, width: size, fontSize: size * 0.5 }}
    >
      S
    </div>
  )
}
