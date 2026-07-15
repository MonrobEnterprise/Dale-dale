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

const ESTADO_BADGE = {
  nueva: 'bg-menta/20 text-menta',
  actualiza: 'bg-dorado/20 text-dorado',
  error: 'bg-coral/20 text-coral',
}

const ESTADO_LABEL = {
  nueva: 'Nueva',
  actualiza: 'Actualiza existente',
  error: 'Error',
}

function normalizar(v) {
  return String(v ?? '').trim()
}

function money(n) {
  return `$${Number(n).toFixed(2)}`
}

export default function ImportarExcelTab() {
  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [variantesSku, setVariantesSku] = useState(new Map())
  const [loadingCache, setLoadingCache] = useState(true)

  const [filas, setFilas] = useState([])
  const [procesando, setProcesando] = useState(false)
  const [resumen, setResumen] = useState(null)

  async function loadCache() {
    setLoadingCache(true)
    const [catRes, prodRes, varRes] = await Promise.all([
      supabase.from('categorias').select('id, nombre'),
      supabase.from('productos').select('id, nombre, categoria_id'),
      supabase.from('variantes').select('id, sku').not('sku', 'is', null),
    ])
    setCategorias(catRes.data ?? [])
    setProductos(prodRes.data ?? [])
    const mapa = new Map()
    for (const v of varRes.data ?? []) {
      if (v.sku) mapa.set(v.sku.toLowerCase(), v)
    }
    setVariantesSku(mapa)
    setLoadingCache(false)
  }

  useEffect(() => {
    loadCache()
  }, [])

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
    const skuCount = new Map()
    for (const r of rows) {
      const sku = normalizar(r.sku).toLowerCase()
      if (sku) skuCount.set(sku, (skuCount.get(sku) ?? 0) + 1)
    }

    return rows.map((r, i) => {
      const errores = []
      const categoria = normalizar(r.categoria)
      const producto = normalizar(r.producto)
      const sku = normalizar(r.sku)

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

      if (sku && skuCount.get(sku.toLowerCase()) > 1) {
        errores.push('SKU duplicado en el archivo.')
      }

      const varianteExistente = sku ? variantesSku.get(sku.toLowerCase()) : null

      return {
        rowNum: i + 2,
        categoria,
        producto,
        descripcion: normalizar(r.descripcion) || null,
        tamano: normalizar(r.tamano) || null,
        color: normalizar(r.color) || null,
        tema: normalizar(r.tema) || null,
        sku: sku || null,
        precio,
        costo,
        stock,
        stock_minimo: stockMinimo,
        varianteExistenteId: varianteExistente?.id ?? null,
        estado: errores.length > 0 ? 'error' : varianteExistente ? 'actualiza' : 'nueva',
        errores,
      }
    })
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setResumen(null)
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
    setFilas(validarFilas(rows))
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

    for (const fila of filas) {
      if (fila.estado === 'error') continue

      try {
        if (fila.estado === 'actualiza' && modo === 'solo-nuevas') {
          resumenLocal.omitidas.push({
            rowNum: fila.rowNum,
            motivo: 'Ya existe una variante con ese SKU (modo "solo agregar nuevas").',
          })
          continue
        }

        let cat = categoriasCache.find((c) => c.nombre.toLowerCase() === fila.categoria.toLowerCase())
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
          (p) => p.categoria_id === cat.id && p.nombre.toLowerCase() === fila.producto.toLowerCase(),
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

        const payloadVariante = {
          producto_id: prod.id,
          sku: fila.sku,
          tamano: fila.tamano,
          color: fila.color,
          tema: fila.tema,
          precio: fila.precio,
          costo: fila.costo,
          stock: fila.stock,
          stock_minimo: fila.stock_minimo,
        }

        if (fila.estado === 'actualiza') {
          const { error } = await supabase.from('variantes').update(payloadVariante).eq('id', fila.varianteExistenteId)
          if (error) throw error
          resumenLocal.variantesActualizadas += 1
        } else {
          const { error } = await supabase.from('variantes').insert(payloadVariante)
          if (error) throw error
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
    { key: 'sku', label: 'SKU', render: (row) => row.sku ?? '—' },
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
