-- Dale, dale!! POS — Fase 2: conecta movimientos_inventario con variantes.stock
-- Fase 1 dejó las tablas listas pero sin trigger que aplicara el efecto de un
-- movimiento sobre el stock; esta migración cierra ese hueco.

-- Aplica el efecto de un movimiento de inventario sobre variantes.stock.
-- security definer, mismo patrón acotado que descontar_stock() /
-- reponer_stock_cancelacion(): la policy de escritura en `variantes` es
-- admin-only, y aunque hoy sólo el admin puede insertar en
-- movimientos_inventario, mantenemos el patrón para no depender de que el
-- invocador tenga UPDATE directo en `variantes`.
--
-- Convención de signos (cantidad siempre >= 0 en la fila, ver constraint):
--   entrada -> suma cantidad al stock.
--   salida  -> resta cantidad; si el resultado sería negativo, se rechaza.
--   ajuste  -> fija el stock al valor absoluto de cantidad (conteo físico),
--              no es un delta: así el admin captura "cuento 14 piezas" sin
--              tener que calcular la diferencia contra el sistema.
create or replace function public.aplicar_movimiento_inventario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock_actual int;
begin
  if new.tipo = 'entrada' then
    update public.variantes
    set stock = stock + new.cantidad
    where id = new.variante_id;

  elsif new.tipo = 'salida' then
    select stock into v_stock_actual
    from public.variantes
    where id = new.variante_id
    for update;

    if v_stock_actual - new.cantidad < 0 then
      raise exception 'Stock insuficiente para la variante % (stock actual: %, cantidad: %).',
        new.variante_id, v_stock_actual, new.cantidad;
    end if;

    update public.variantes
    set stock = stock - new.cantidad
    where id = new.variante_id;

  elsif new.tipo = 'ajuste' then
    update public.variantes
    set stock = new.cantidad
    where id = new.variante_id;
  end if;

  return new;
end;
$$;

create trigger trg_aplicar_movimiento_inventario
  after insert on movimientos_inventario
  for each row
  execute function public.aplicar_movimiento_inventario();

-- Permite 0 (un conteo puede dar vacío en un ajuste); nunca negativo.
alter table movimientos_inventario
  add constraint movimientos_inventario_cantidad_check check (cantidad >= 0);

-- Función de trigger: nadie puede invocarla vía RPC de todos modos, pero
-- revocamos por rol siguiendo el mismo criterio que descontar_stock() /
-- reponer_stock_cancelacion() en la migración de Fase 1. Postgres además
-- otorga EXECUTE a PUBLIC por defecto al crear la función, y anon/
-- authenticated heredan ese grant vía PUBLIC aunque se les revoque a ellos
-- explícitamente, así que hay que revocarlo también de PUBLIC.
revoke execute on function public.aplicar_movimiento_inventario()
  from anon, authenticated, service_role;
revoke execute on function public.aplicar_movimiento_inventario() from public;
