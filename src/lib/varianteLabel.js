export function varianteLabel(v) {
  const desc = [v.tamano, v.color, v.tema].filter(Boolean).join(' · ')
  return [v.productos?.nombre, desc, v.sku ? `SKU ${v.sku}` : null].filter(Boolean).join(' — ')
}
