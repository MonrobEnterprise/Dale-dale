export function ActivoBadge({ activo }) {
  return (
    <span
      className={
        'rounded-full px-2 py-0.5 text-xs font-medium ' +
        (activo ? 'bg-menta/20 text-menta' : 'bg-navy/10 text-navy/50')
      }
    >
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}
