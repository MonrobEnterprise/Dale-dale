const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const DIAS_RANGO = { dia: 14, semana: 8 * 7, mes: 6 * 31 }

function pad2(n) {
  return String(n).padStart(2, '0')
}

function inicioDelDia(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function lunesDeLaSemana(d) {
  const dia = d.getDay() // 0 = domingo
  const offset = dia === 0 ? -6 : 1 - dia
  const lunes = new Date(d)
  lunes.setDate(d.getDate() + offset)
  return inicioDelDia(lunes)
}

export function rangoDesde(granularidad) {
  const dias = DIAS_RANGO[granularidad] ?? DIAS_RANGO.dia
  const desde = new Date()
  desde.setDate(desde.getDate() - dias)
  return inicioDelDia(desde)
}

export function bucketKey(fechaISO, granularidad) {
  const d = new Date(fechaISO)
  if (granularidad === 'mes') {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
  }
  if (granularidad === 'semana') {
    const lunes = lunesDeLaSemana(d)
    return `${lunes.getFullYear()}-${pad2(lunes.getMonth() + 1)}-${pad2(lunes.getDate())}`
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function bucketLabel(key, granularidad) {
  if (granularidad === 'mes') {
    const [anio, mes] = key.split('-').map(Number)
    return `${MESES[mes - 1]} ${anio}`
  }
  const [, mes, dia] = key.split('-').map(Number)
  const etiqueta = `${dia} ${MESES[mes - 1]}`
  return granularidad === 'semana' ? `sem. ${etiqueta}` : etiqueta
}
