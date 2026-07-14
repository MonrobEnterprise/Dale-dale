const inputClass =
  'w-full rounded-lg border border-navy/20 px-3 py-2 text-navy focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/30'

export function FormField({ label, type = 'text', error, children, ...props }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block font-medium text-navy">{label}</span>
      {type === 'select' ? (
        <select className={inputClass} {...props}>
          {children}
        </select>
      ) : type === 'textarea' ? (
        <textarea className={inputClass} {...props} />
      ) : (
        <input type={type} className={inputClass} {...props} />
      )}
      {error && <span className="mt-1 block text-xs text-coral">{error}</span>}
    </label>
  )
}
