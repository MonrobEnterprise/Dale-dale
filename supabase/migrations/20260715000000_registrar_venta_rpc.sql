-- Dale, dale!! POS — checkout atómico (Fase 3)
--
-- Inserta ventas + venta_detalle + pagos en una sola transacción de Postgres.
-- No hay policy de DELETE sobre `ventas` (nunca se borran), así que insertar
-- estas tres tablas en pasos separados desde el cliente dejaría una fila de
-- `ventas` huérfana e irrecuperable si un paso posterior falla (ej. stock
-- insuficiente a mitad del carrito). Al envolver todo en una función, un
-- `raise exception` de cualquiera de los triggers existentes (folio,
-- check_corte_abierto, descontar_stock, validar_pagos_completos) revierte
-- las tres inserciones sin dejar residuos.
--
-- Sin `security definer`: el cajero ya tiene permiso de INSERT en las tres
-- tablas vía las policies de RLS existentes, así que no hace falta elevar
-- privilegios — sólo se gana atomicidad. Los triggers y policies se evalúan
-- igual que si el cliente hiciera los inserts directo.
create or replace function public.registrar_venta(
  p_corte_id int,
  p_descuento numeric,
  p_detalle jsonb, -- [{variante_id, cantidad, precio_unitario}, ...]
  p_pagos jsonb     -- [{metodo, monto}, ...]
)
returns table (venta_id int, folio text)
language plpgsql
set search_path = ''
as $$
declare
  v_subtotal numeric(10,2);
  v_total numeric(10,2);
  v_venta_id int;
  v_folio text;
begin
  select coalesce(sum((item->>'cantidad')::int * (item->>'precio_unitario')::numeric), 0)
    into v_subtotal
  from jsonb_array_elements(p_detalle) item;

  v_total := greatest(v_subtotal - coalesce(p_descuento, 0), 0);

  insert into public.ventas (usuario_id, corte_id, subtotal, descuento, total)
  values ((select auth.uid()), p_corte_id, v_subtotal, coalesce(p_descuento, 0), v_total)
  returning id, ventas.folio into v_venta_id, v_folio;

  insert into public.venta_detalle (venta_id, variante_id, cantidad, precio_unitario, subtotal)
  select v_venta_id,
         (item->>'variante_id')::int,
         (item->>'cantidad')::int,
         (item->>'precio_unitario')::numeric,
         (item->>'cantidad')::int * (item->>'precio_unitario')::numeric
  from jsonb_array_elements(p_detalle) item;

  insert into public.pagos (venta_id, metodo, monto)
  select v_venta_id, pago->>'metodo', (pago->>'monto')::numeric
  from jsonb_array_elements(p_pagos) pago;

  return query select v_venta_id, v_folio;
end;
$$;

grant execute on function public.registrar_venta(int, numeric, jsonb, jsonb) to authenticated;
