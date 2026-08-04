/* Кубик-загрузка (layers): rotateX-куб с разлетающейся тенью и верхним слоем. */

export function Loader({ size = 60, className }) {
  const shift = Math.max(6, Math.round(size * 0.33))
  return (
    <span
      className={`loader${className ? ` ${className}` : ''}`}
      style={{ '--loader-size': `${size}px`, '--loader-shift': `${shift}px` }}
      aria-hidden="true"
    />
  )
}
