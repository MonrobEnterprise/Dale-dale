export function DataTable({ columns, rows, onRowClick, emptyMessage = 'Sin datos.' }) {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-navy/60">{emptyMessage}</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-navy/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-navy/5 text-navy/70">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-2 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy/10">
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer hover:bg-coral/5' : undefined}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2 text-navy">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
