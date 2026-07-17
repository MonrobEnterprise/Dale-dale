import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { supabase } from '../../../lib/supabaseClient'
import { friendlyError } from '../../../lib/errorMessages'
import { DataTable } from '../../../components/admin/DataTable'
import logoPinata from '../../../assets/logo-pinata.png'

// Paleta institucional (misma que src/index.css) usada también en la
// plantilla descargable, para que se vea consistente con el resto de la app.
const COLOR_NAVY = 'FF14315C'
const COLOR_CORAL = 'FFF26A5C'
const COLOR_BORDE = 'FFE0DACD' // crema oscurecido, para gridlines discretos

const FILAS_VACIAS_PLANTILLA = 50

const COLUMNAS_PLANTILLA = [
  'categoria',
  'producto',
  'descripcion',
  'tamano',
  'color',
  'tema',
  'sku',
  'precio',
  'costo',
  'stock',
  'stock_minimo',
]

// Nombre de encabezado esperado (ya normalizado: sin acentos, minúsculas) por
// campo interno. La columna "sku" del Excel es el código de barras del
// fabricante (ver comentario en handleFile) — no el sku interno del sistema.
const ENCABEZADOS_ESPERADOS = {
  categoria: 'categoria',
  producto: 'producto',
  descripcion: 'descripcion',
  tamano: 'tamano',
  color: 'color',
  tema: 'tema',
  sku: 'sku',
  precio: 'precio',
  costo: 'costo',
  stock: 'stock',
  stock_minimo: 'stock_minimo',
}

const ESTADO_BADGE = {
  nueva: 'bg-menta/20 text-menta',
  actualiza: 'bg-dorado/20 text-dorado',
  conflicto: 'bg-navy/20 text-navy',
  error: 'bg-coral/20 text-coral',
}

const ESTADO_LABEL = {
  nueva: 'Nueva',
  actualiza: 'Actualiza existente',
  conflicto: 'Variante repetida en el archivo',
  error: 'Error',
}

function normalizar(v) {
  return String(v ?? '').trim()
}

// Para comparar (encabezados, categoría/producto existentes, combos de
// variante): sin acentos y sin distinguir mayúsculas. Nunca se usa para lo
// que se guarda o se muestra — sólo para decidir si dos valores son "el
// mismo" dato capturado de formas distintas.
function normalizarClave(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

// El catálogo real de Hugo usa el texto literal "S/S" (con variaciones de
// mayúsculas/espacios) para "sin código de barras" — se trata como vacío.
function esCodigoVacio(v) {
  const c = normalizarClave(v).replace(/\s+/g, '')
  return c === '' || c === 's/s'
}

function money(n) {
  return `$${Number(n).toFixed(2)}`
}

function comboKey(productoId, tamano, color, tema) {
  return [productoId, normalizarClave(tamano), normalizarClave(color), normalizarClave(tema)].join('|')
}

// Lee la hoja "Inventario" (ignora cualquier otra hoja, como el "Hoja1" de
// notas de gastos de Hugo). La primera fila es un título de sección, así que
// se ubica la fila de encabezados reales buscando por nombre de columna en
// vez de asumir un número de fila fijo — así aguanta si Hugo agrega o quita
// filas arriba en el futuro.
function leerHojaInventario(wb) {
  const sheetName = wb.SheetNames.find((n) => normalizarClave(n) === 'inventario')
  if (!sheetName) {
    throw new Error('No se encontró la hoja "Inventario" en el archivo.')
  }

  const filasCrudas = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' })

  const headerIdx = filasCrudas.findIndex((fila) => {
    const normalizadas = fila.map(normalizarClave)
    return normalizadas.includes('categoria') && normalizadas.includes('producto')
  })
  if (headerIdx === -1) {
    throw new Error(
      'No se encontraron los encabezados esperados (Categoria, Producto, …) en la hoja "Inventario".',
    )
  }

  const encabezados = filasCrudas[headerIdx].map(normalizarClave)
  const colIndex = {}
  for (const [campo, nombreEsperado] of Object.entries(ENCABEZADOS_ESPERADOS)) {
    colIndex[campo] = encabezados.indexOf(nombreEsperado)
  }

  const rows = []
  for (let i = headerIdx + 1; i < filasCrudas.length; i++) {
    const fila = filasCrudas[i]
    const get = (campo) => {
      const idx = colIndex[campo]
      return idx == null || idx === -1 ? '' : (fila[idx] ?? '')
    }

    const categoria = normalizar(get('categoria'))
    const producto = normalizar(get('producto'))
    if (!categoria && !producto) continue // fila vacía de relleno (plantilla) — se ignora en silencio

    rows.push({
      rowNum: i + 1, // fila real del archivo (1-based)
      categoria,
      producto,
      descripcion: get('descripcion'),
      tamano: get('tamano'),
      color: get('color'),
      tema: get('tema'),
      sku: get('sku'), // código de barras en el Excel de Hugo
      precio: get('precio'),
      costo: get('costo'),
      stock: get('stock'),
      stock_minimo: get('stock_minimo'),
    })
  }
  return rows
}

export default function ImportarExcelTab() {
  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [variantesCombo, setVariantesCombo] = useState(new Map())
  const [loadingCache, setLoadingCache] = useState(true)

  const [filas, setFilas] = useState([])
  const [errorArchivo, setErrorArchivo] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [resumen, setResumen] = useState(null)

  async function loadCache() {
    setLoadingCache(true)
    const [catRes, prodRes, varRes] = await Promise.all([
      supabase.from('categorias').select('id, nombre'),
      supabase.from('productos').select('id, nombre, categoria_id'),
      supabase.from('variantes').select('id, producto_id, tamano, color, tema'),
    ])
    setCategorias(catRes.data ?? [])
    setProductos(prodRes.data ?? [])
    const mapa = new Map()
    for (const v of varRes.data ?? []) {
      mapa.set(comboKey(v.producto_id, v.tamano, v.color, v.tema), v)
    }
    setVariantesCombo(mapa)
    setLoadingCache(false)
  }

  useEffect(() => {
    loadCache()
  }, [])

  function buscarProductoExistente(categoria, producto) {
    const cat = categorias.find((c) => normalizarClave(c.nombre) === normalizarClave(categoria))
    if (!cat) return null
    return productos.find(
      (p) => p.categoria_id === cat.id && normalizarClave(p.nombre) === normalizarClave(producto),
    ) ?? null
  }

  async function cargarLogoBase64() {
    const res = await fetch(logoPinata)
    const blob = await res.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  async function descargarPlantilla() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Inventario')

    sheet.columns = [
      { key: 'categoria', width: 16 },
      { key: 'producto', width: 30 },
      { key: 'descripcion', width: 32 },
      { key: 'tamano', width: 12 },
      { key: 'color', width: 12 },
      { key: 'tema', width: 12 },
      { key: 'sku', width: 18 },
      { key: 'precio', width: 12 },
      { key: 'costo', width: 12 },
      { key: 'stock', width: 10 },
      { key: 'stock_minimo', width: 14 },
    ]

    const bordeClaro = {
      top: { style: 'thin', color: { argb: COLOR_BORDE } },
      left: { style: 'thin', color: { argb: COLOR_BORDE } },
      bottom: { style: 'thin', color: { argb: COLOR_BORDE } },
      right: { style: 'thin', color: { argb: COLOR_BORDE } },
    }

    // Encabezado: logo (col. A, filas 1-2) + título (col. B-K, filas 1-2),
    // fondo navy institucional — mismo esquema de color que el header de la app.
    sheet.mergeCells('A1:A2')
    sheet.mergeCells('B1:K2')
    sheet.getRow(1).height = 30
    sheet.getRow(2).height = 30

    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } }

    const tituloCelda = sheet.getCell('B1')
    tituloCelda.value = 'Inventario de Productos'
    tituloCelda.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
    tituloCelda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    tituloCelda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } }

    const logoBase64 = await cargarLogoBase64()
    const imageId = workbook.addImage({ base64: logoBase64, extension: 'png' })
    sheet.addImage(imageId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 48, height: 48 } })

    // Encabezados de columna: fondo coral institucional, texto centrado y
    // envuelto para que ningún nombre de columna se corte.
    const headerRow = sheet.getRow(3)
    headerRow.values = COLUMNAS_PLANTILLA
    headerRow.height = 26
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_CORAL } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = bordeClaro
    })

    // Filas de datos vacías, preformateadas: centradas, con texto envuelto y
    // formato numérico correcto para que quede igual sin importar qué tanto
    // capture el usuario en cada celda. Sin altura fija a propósito: con
    // wrapText activo, Excel expande la fila automáticamente según el texto
    // que se capture, en vez de recortarlo a una altura predefinida.
    for (let i = 4; i <= 3 + FILAS_VACIAS_PLANTILLA; i++) {
      const row = sheet.getRow(i)
      for (let col = 1; col <= COLUMNAS_PLANTILLA.length; col++) {
        const cell = row.getCell(col)
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = bordeClaro
      }
      row.getCell(8).numFmt = '0.00' // precio
      row.getCell(9).numFmt = '0.00' // costo
      row.getCell(10).numFmt = '0' // stock
      row.getCell(11).numFmt = '0' // stock_minimo
    }

    sheet.views = [{ state: 'frozen', ySplit: 3 }]

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla-catalogo-dale-dale.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  function validarFilas(rows) {
    const conteoCombos = new Map()
    for (const r of rows) {
      const key = [normalizarClave(r.categoria), normalizarClave(r.producto), normalizarClave(r.tamano), normalizarClave(r.color), normalizarClave(r.tema)].join('||')
      conteoCombos.set(key, (conteoCombos.get(key) ?? 0) + 1)
    }

    return rows.map((r) => {
      const errores = []
      const categoria = normalizar(r.categoria)
      const producto = normalizar(r.producto)
      const tamano = normalizar(r.tamano) || null
      const color = normalizar(r.color) || null
      const tema = normalizar(r.tema) || null

      if (!categoria) errores.push('Falta la categoría.')
      if (!producto) errores.push('Falta el producto.')

      const precio = r.precio === '' || r.precio == null ? NaN : Number(r.precio)
      if (Number.isNaN(precio) || precio < 0) {
        errores.push('Precio inválido (obligatorio, numérico, ≥ 0).')
      }

      let costo = null
      if (r.costo !== '' && r.costo != null) {
        costo = Number(r.costo)
        if (Number.isNaN(costo) || costo < 0) errores.push('Costo inválido.')
      }

      let stock = 0
      if (r.stock !== '' && r.stock != null) {
        stock = Number(r.stock)
        if (Number.isNaN(stock) || stock < 0) errores.push('Stock inválido.')
      }

      let stockMinimo = 3
      if (r.stock_minimo !== '' && r.stock_minimo != null) {
        stockMinimo = Number(r.stock_minimo)
        if (Number.isNaN(stockMinimo) || stockMinimo < 0) errores.push('Stock mínimo inválido.')
      }

      const codigoBarras = esCodigoVacio(r.sku) ? null : normalizar(r.sku)

      const productoExistente = categoria && producto ? buscarProductoExistente(categoria, producto) : null
      const varianteExistente = productoExistente
        ? variantesCombo.get(comboKey(productoExistente.id, tamano, color, tema))
        : null

      const key = [normalizarClave(categoria), normalizarClave(producto), normalizarClave(tamano), normalizarClave(color), normalizarClave(tema)].join('||')
      const esDuplicadoEnArchivo = categoria && producto && conteoCombos.get(key) > 1

      let estado
      if (errores.length > 0) estado = 'error'
      else if (esDuplicadoEnArchivo) estado = 'conflicto'
      else if (varianteExistente) estado = 'actualiza'
      else estado = 'nueva'

      return {
        rowNum: r.rowNum,
        categoria,
        producto,
        descripcion: normalizar(r.descripcion) || null,
        tamano,
        color,
        tema,
        codigo_barras: codigoBarras,
        precio,
        costo,
        stock,
        stock_minimo: stockMinimo,
        varianteExistenteId: varianteExistente?.id ?? null,
        estado,
        accion: estado === 'conflicto' ? (varianteExistente ? 'actualizar' : 'nueva') : null,
        errores,
      }
    })
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setResumen(null)
    setErrorArchivo(null)
    setFilas([])
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const rows = leerHojaInventario(wb)
      setFilas(validarFilas(rows))
    } catch (err) {
      setErrorArchivo(err.message || 'No se pudo leer el archivo.')
    }
  }

  function cambiarAccionFila(rowNum, accion) {
    setFilas((prev) => prev.map((f) => (f.rowNum === rowNum ? { ...f, accion } : f)))
  }

  async function procesarImportacion(modo) {
    setProcesando(true)
    const resumenLocal = {
      categoriasCreadas: 0,
      productosCreados: 0,
      variantesCreadas: 0,
      variantesActualizadas: 0,
      omitidas: [],
    }

    const categoriasCache = [...categorias]
    const productosCache = [...productos]
    const combosCache = new Map(variantesCombo)

    for (const fila of filas) {
      if (fila.estado === 'error') continue

      try {
        if (fila.estado === 'actualiza' && modo === 'solo-nuevas') {
          resumenLocal.omitidas.push({
            rowNum: fila.rowNum,
            motivo: 'Ya existe una variante con esa combinación producto/tamaño/color/tema (modo "solo agregar nuevas").',
          })
          continue
        }

        let cat = categoriasCache.find((c) => normalizarClave(c.nombre) === normalizarClave(fila.categoria))
        if (!cat) {
          const { data, error } = await supabase
            .from('categorias')
            .insert({ nombre: fila.categoria })
            .select()
            .single()
          if (error) throw error
          cat = data
          categoriasCache.push(cat)
          resumenLocal.categoriasCreadas += 1
        }

        let prod = productosCache.find(
          (p) => p.categoria_id === cat.id && normalizarClave(p.nombre) === normalizarClave(fila.producto),
        )
        if (!prod) {
          const { data, error } = await supabase
            .from('productos')
            .insert({ categoria_id: cat.id, nombre: fila.producto, descripcion: fila.descripcion })
            .select()
            .single()
          if (error) throw error
          prod = data
          productosCache.push(prod)
          resumenLocal.productosCreados += 1
        }

        const key = comboKey(prod.id, fila.tamano, fila.color, fila.tema)
        const existente = combosCache.get(key)
        const accion = fila.estado === 'conflicto' ? fila.accion : fila.estado === 'actualiza' ? 'actualizar' : 'nueva'

        // El sku interno NO se manda: lo genera el sistema (ver migración
        // 20260717000000). Sólo se manda codigo_barras.
        const payloadVariante = {
          producto_id: prod.id,
          codigo_barras: fila.codigo_barras,
          tamano: fila.tamano,
          color: fila.color,
          tema: fila.tema,
          precio: fila.precio,
          costo: fila.costo,
          stock: fila.stock,
          stock_minimo: fila.stock_minimo,
        }

        if (accion === 'actualizar' && existente) {
          const { error } = await supabase.from('variantes').update(payloadVariante).eq('id', existente.id)
          if (error) throw error
          resumenLocal.variantesActualizadas += 1
        } else {
          const { data, error } = await supabase.from('variantes').insert(payloadVariante).select().single()
          if (error) throw error
          combosCache.set(key, data)
          resumenLocal.variantesCreadas += 1
        }
      } catch (err) {
        resumenLocal.omitidas.push({
          rowNum: fila.rowNum,
          motivo: friendlyError(err, 'Error inesperado al guardar esta fila.'),
        })
      }
    }

    setResumen(resumenLocal)
    setFilas([])
    await loadCache()
    setProcesando(false)
  }

  const filasValidas = filas.filter((f) => f.estado !== 'error').length

  const columns = [
    { key: 'rowNum', label: 'Fila' },
    { key: 'categoria', label: 'Categoría' },
    { key: 'producto', label: 'Producto' },
    {
      key: 'variante',
      label: 'Variante',
      render: (row) => [row.tamano, row.color, row.tema].filter(Boolean).join(' · ') || '—',
    },
    { key: 'codigo_barras', label: 'Código de barras', render: (row) => row.codigo_barras ?? '—' },
    { key: 'precio', label: 'Precio', render: (row) => (Number.isNaN(row.precio) ? '—' : money(row.precio)) },
    {
      key: 'estado',
      label: 'Estado',
      render: (row) => (
        <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + ESTADO_BADGE[row.estado]}>
          {ESTADO_LABEL[row.estado]}
        </span>
      ),
    },
    {
      key: 'accion',
      label: 'Acción',
      render: (row) =>
        row.estado === 'conflicto' ? (
          <select
            value={row.accion}
            onChange={(e) => cambiarAccionFila(row.rowNum, e.target.value)}
            className="rounded-lg border border-navy/20 px-2 py-1 text-xs"
          >
            <option value="actualizar">Actualizar existente</option>
            <option value="nueva">Agregar como nueva</option>
          </select>
        ) : (
          '—'
        ),
    },
    {
      key: 'errores',
      label: 'Detalle',
      render: (row) => (row.errores.length > 0 ? row.errores.join(' ') : '—'),
    },
  ]

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={descargarPlantilla}
          className="rounded-lg bg-navy/10 px-4 py-2 text-sm font-medium text-navy hover:bg-navy/20"
        >
          Descargar plantilla
        </button>
        <label className="rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white hover:brightness-95">
          Subir archivo Excel
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" disabled={loadingCache} />
        </label>
        {loadingCache && <span className="text-sm text-navy/60">Cargando catálogo actual…</span>}
      </div>

      {errorArchivo && (
        <div className="mb-6 rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral">{errorArchivo}</div>
      )}

      {resumen && (
        <div className="mb-6 rounded-lg bg-navy/5 px-4 py-3 text-sm text-navy/80">
          <p className="mb-1 font-medium text-navy">Importación terminada</p>
          <p>Categorías creadas: {resumen.categoriasCreadas}</p>
          <p>Productos creados: {resumen.productosCreados}</p>
          <p>Variantes creadas: {resumen.variantesCreadas}</p>
          <p>Variantes actualizadas: {resumen.variantesActualizadas}</p>
          <p>Filas omitidas: {resumen.omitidas.length}</p>
          {resumen.omitidas.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {resumen.omitidas.map((o) => (
                <li key={o.rowNum}>
                  Fila {o.rowNum}: {o.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {filas.length > 0 && (
        <>
          <h3 className="mb-3 font-semibold text-navy">
            Vista previa ({filasValidas} de {filas.length} filas listas para procesar)
          </h3>
          <div className="mb-4">
            <DataTable columns={columns} rows={filas.map((f) => ({ ...f, id: f.rowNum }))} />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => procesarImportacion('actualizar')}
              disabled={filasValidas === 0 || procesando}
              className="rounded-lg bg-coral px-4 py-2 font-medium text-white hover:brightness-95 disabled:opacity-40"
            >
              {procesando ? 'Procesando…' : 'Actualizar existentes y agregar nuevas'}
            </button>
            <button
              type="button"
              onClick={() => procesarImportacion('solo-nuevas')}
              disabled={filasValidas === 0 || procesando}
              className="rounded-lg bg-navy/10 px-4 py-2 font-medium text-navy hover:bg-navy/20 disabled:opacity-40"
            >
              {procesando ? 'Procesando…' : 'Solo agregar nuevas'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
