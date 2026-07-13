-- Dale, dale!! POS — esquema inicial (Fase 1)
-- Tablas, integridad de negocio (folio, stock, caja abierta) y RLS por rol.

-- =========================================================================
-- 1. PERFILES
-- =========================================================================

create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('admin', 'cajero')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Resuelve el rol del usuario autenticado sin recursión de RLS sobre `perfiles`.
-- security definer es necesario aquí porque una policy de `perfiles` que
-- consultara `perfiles` directamente entraría en recursión; la función sólo
-- expone el rol del propio auth.uid(), nunca datos de otros usuarios.
create or replace function public.current_rol()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select rol from public.perfiles where id = (select auth.uid());
$$;

-- =========================================================================
-- 2. CATÁLOGO
-- =========================================================================

create table categorias (
  id serial primary key,
  nombre text not null,
  activo boolean not null default true
);

create table productos (
  id serial primary key,
  categoria_id int references categorias(id),
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table variantes (
  id serial primary key,
  producto_id int not null references productos(id) on delete cascade,
  sku text unique,
  tamano text,
  color text,
  tema text,
  precio numeric(10,2) not null check (precio >= 0),
  costo numeric(10,2) check (costo >= 0),
  stock int not null default 0 check (stock >= 0),
  stock_minimo int not null default 3,
  activo boolean not null default true
);

create table movimientos_inventario (
  id serial primary key,
  variante_id int not null references variantes(id),
  tipo text not null check (tipo in ('entrada', 'salida', 'ajuste')),
  cantidad int not null,
  motivo text,
  usuario_id uuid references perfiles(id),
  created_at timestamptz not null default now()
);

-- =========================================================================
-- 3. CAJA
-- =========================================================================

create table cortes_caja (
  id serial primary key,
  usuario_id uuid not null references perfiles(id),
  fecha_apertura timestamptz not null default now(),
  fecha_cierre timestamptz,
  efectivo_inicial numeric(10,2) not null default 0,
  efectivo_esperado numeric(10,2),
  efectivo_contado numeric(10,2),
  diferencia numeric(10,2),
  total_ventas numeric(10,2) default 0,
  total_efectivo numeric(10,2) default 0,
  total_tarjeta numeric(10,2) default 0,
  total_transferencia numeric(10,2) default 0,
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  notas text
);

-- Un usuario sólo puede tener una caja abierta a la vez.
create unique index cortes_caja_una_abierta_por_usuario
  on cortes_caja (usuario_id)
  where estado = 'abierta';

-- =========================================================================
-- 4. VENTAS
-- =========================================================================

create sequence ventas_folio_seq;

create table ventas (
  id serial primary key,
  folio text unique,
  usuario_id uuid not null references perfiles(id),
  corte_id int not null references cortes_caja(id),
  subtotal numeric(10,2) not null check (subtotal >= 0),
  descuento numeric(10,2) not null default 0 check (descuento >= 0),
  total numeric(10,2) not null check (total >= 0),
  estado text not null default 'completada' check (estado in ('completada', 'cancelada')),
  created_at timestamptz not null default now()
);

create table venta_detalle (
  id serial primary key,
  venta_id int not null references ventas(id) on delete cascade,
  variante_id int not null references variantes(id),
  cantidad int not null check (cantidad > 0),
  precio_unitario numeric(10,2) not null check (precio_unitario >= 0),
  subtotal numeric(10,2) not null check (subtotal >= 0)
);

create table pagos (
  id serial primary key,
  venta_id int not null references ventas(id) on delete cascade,
  metodo text not null check (metodo in ('efectivo', 'tarjeta', 'transferencia')),
  monto numeric(10,2) not null check (monto > 0)
);

-- Folio consecutivo automático: DD-000123
create or replace function public.set_venta_folio()
returns trigger
language plpgsql
as $$
begin
  if new.folio is null then
    new.folio := 'DD-' || lpad(nextval('ventas_folio_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger trg_set_venta_folio
  before insert on ventas
  for each row
  execute function public.set_venta_folio();

-- No se puede vender sin una caja abierta del usuario en turno.
create or replace function public.check_corte_abierto()
returns trigger
language plpgsql
as $$
declare
  v_estado text;
  v_usuario uuid;
begin
  select estado, usuario_id into v_estado, v_usuario
  from cortes_caja
  where id = new.corte_id;

  if v_estado is null then
    raise exception 'El corte de caja indicado no existe.';
  end if;

  if v_estado <> 'abierta' then
    raise exception 'No se puede vender: la caja (corte %) no está abierta.', new.corte_id;
  end if;

  if v_usuario <> new.usuario_id then
    raise exception 'El corte de caja pertenece a otro usuario.';
  end if;

  return new;
end;
$$;

create trigger trg_check_corte_abierto
  before insert on ventas
  for each row
  execute function public.check_corte_abierto();

-- Descuenta stock al insertar el detalle de venta; bloquea sobreventa.
-- security definer: la policy de escritura en `variantes` sólo permite admin,
-- pero un cajero debe poder generar este descuento al vender. El cuerpo no
-- toma entrada libre del usuario más allá de cantidad/variante ya validadas
-- por las policies de venta_detalle, así que el alcance es acotado.
create or replace function public.descontar_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.variantes
  set stock = stock - new.cantidad
  where id = new.variante_id;

  if (select stock from public.variantes where id = new.variante_id) < 0 then
    raise exception 'Stock insuficiente para la variante %.', new.variante_id;
  end if;

  return new;
end;
$$;

create trigger trg_descontar_stock
  after insert on venta_detalle
  for each row
  execute function public.descontar_stock();

-- Repone stock al cancelar una venta (transición completada -> cancelada).
-- Idempotente por construcción: sólo dispara en esa transición exacta, así
-- que cancelar una venta que ya está cancelada no vuelve a sumar stock.
--
-- Se agrega por variante_id con una subconsulta (sum + group by) en vez de
-- un UPDATE ... FROM venta_detalle directo: si una venta tuviera dos filas
-- de venta_detalle para la misma variante, un UPDATE ... FROM con múltiples
-- filas fuente que matchean la misma fila destino sólo aplica una de ellas
-- (no las acumula), y esto pasaría silenciosamente sin error.
--
-- security definer, mismo patrón acotado que descontar_stock(): hoy sólo el
-- admin puede cambiar `estado` (ver ventas_update_admin), pero no queremos
-- que este trigger dependa de que el invocador tenga UPDATE directo en
-- `variantes` — igual que la venta original, es una mutación controlada por
-- el propio trigger, no por input libre del usuario.
create or replace function public.reponer_stock_cancelacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.estado = 'completada' and new.estado = 'cancelada' then
    update public.variantes v
    set stock = v.stock + agg.total_cantidad
    from (
      select variante_id, sum(cantidad) as total_cantidad
      from public.venta_detalle
      where venta_id = new.id
      group by variante_id
    ) agg
    where v.id = agg.variante_id;
  end if;

  return new;
end;
$$;

create trigger trg_reponer_stock_cancelacion
  after update on ventas
  for each row
  execute function public.reponer_stock_cancelacion();

-- Valida que los pagos de una venta cubran el total antes de que la
-- transacción confirme. Los pagos (uno o varios, por método) se insertan
-- después de `ventas`, en la misma transacción del checkout — por eso es un
-- constraint trigger DEFERRABLE INITIALLY DEFERRED: se ejecuta una sola vez
-- al final de la transacción (COMMIT), cuando ya existen todas las filas de
-- `pagos` de esa venta, en vez de fallar en cada INSERT parcial mientras se
-- va dividiendo el pago entre efectivo/tarjeta/transferencia.
--
-- Importante para el frontend: todas las filas de pago de una venta deben
-- insertarse en una sola llamada (`supabase.from('pagos').insert([...])`
-- con un arreglo), no una por una — cada request de PostgREST es su propia
-- transacción, y si se insertan por separado este trigger vería sólo el
-- pago parcial de cada request individual y rechazaría la primera.
--
-- No usa security definer: sólo lee `ventas` y `pagos`, y el usuario que
-- inserta pagos ya tiene SELECT sobre su propia venta y sus propios pagos
-- vía RLS (a diferencia de descontar_stock/reponer_stock_cancelacion, que
-- necesitan escribir en `variantes`, tabla que el cajero no puede tocar
-- directamente).
create or replace function public.validar_pagos_completos()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_total numeric(10,2);
  v_pagado numeric(10,2);
begin
  select total into v_total from public.ventas where id = new.venta_id;

  select coalesce(sum(monto), 0) into v_pagado
  from public.pagos
  where venta_id = new.venta_id;

  if v_pagado <> v_total then
    raise exception 'Los pagos ($%) no cubren el total de la venta ($%).', v_pagado, v_total;
  end if;

  return new;
end;
$$;

create constraint trigger trg_validar_pagos_completos
  after insert on pagos
  deferrable initially deferred
  for each row
  execute function public.validar_pagos_completos();

-- =========================================================================
-- 5. ROW LEVEL SECURITY
-- =========================================================================

alter table perfiles enable row level security;
alter table categorias enable row level security;
alter table productos enable row level security;
alter table variantes enable row level security;
alter table movimientos_inventario enable row level security;
alter table cortes_caja enable row level security;
alter table ventas enable row level security;
alter table venta_detalle enable row level security;
alter table pagos enable row level security;

-- --- perfiles ---
-- Un usuario ve su propio perfil; el admin ve todos.
create policy "perfiles_select" on perfiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.current_rol()) = 'admin');

-- Sólo el admin crea/edita perfiles (gestión de usuarios y roles).
create policy "perfiles_insert_admin" on perfiles
  for insert to authenticated
  with check ((select public.current_rol()) = 'admin');

create policy "perfiles_update_admin" on perfiles
  for update to authenticated
  using ((select public.current_rol()) = 'admin')
  with check ((select public.current_rol()) = 'admin');

-- --- catálogo: lectura para cualquier usuario autenticado, escritura sólo admin ---
create policy "categorias_select" on categorias
  for select to authenticated using (true);
create policy "categorias_write_admin" on categorias
  for all to authenticated
  using ((select public.current_rol()) = 'admin')
  with check ((select public.current_rol()) = 'admin');

create policy "productos_select" on productos
  for select to authenticated using (true);
create policy "productos_write_admin" on productos
  for all to authenticated
  using ((select public.current_rol()) = 'admin')
  with check ((select public.current_rol()) = 'admin');

create policy "variantes_select" on variantes
  for select to authenticated using (true);
create policy "variantes_write_admin" on variantes
  for all to authenticated
  using ((select public.current_rol()) = 'admin')
  with check ((select public.current_rol()) = 'admin');

-- --- movimientos_inventario: sólo admin (entradas/ajustes manuales) ---
create policy "movimientos_select_admin" on movimientos_inventario
  for select to authenticated
  using ((select public.current_rol()) = 'admin');
create policy "movimientos_insert_admin" on movimientos_inventario
  for insert to authenticated
  with check ((select public.current_rol()) = 'admin');
-- Sin policies de update/delete: el historial de movimientos es inmutable.

-- --- cortes_caja: cajero ve/gestiona el suyo; admin ve/gestiona todos ---
create policy "cortes_select" on cortes_caja
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.current_rol()) = 'admin');

create policy "cortes_insert" on cortes_caja
  for insert to authenticated
  with check (usuario_id = (select auth.uid()) or (select public.current_rol()) = 'admin');

create policy "cortes_update" on cortes_caja
  for update to authenticated
  using (usuario_id = (select auth.uid()) or (select public.current_rol()) = 'admin')
  with check (usuario_id = (select auth.uid()) or (select public.current_rol()) = 'admin');

-- --- ventas: cajero ve/crea las suyas; admin ve/gestiona todas ---
-- Cancelar una venta (estado -> 'cancelada') queda reservado al admin;
-- nunca se permite borrar (no hay policy de delete).
create policy "ventas_select" on ventas
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.current_rol()) = 'admin');

create policy "ventas_insert" on ventas
  for insert to authenticated
  with check (usuario_id = (select auth.uid()) or (select public.current_rol()) = 'admin');

create policy "ventas_update_admin" on ventas
  for update to authenticated
  using ((select public.current_rol()) = 'admin')
  with check ((select public.current_rol()) = 'admin');

-- --- venta_detalle / pagos: siguen la propiedad de la venta ---
create policy "venta_detalle_select" on venta_detalle
  for select to authenticated
  using (
    exists (
      select 1 from ventas v
      where v.id = venta_detalle.venta_id
        and (v.usuario_id = (select auth.uid()) or (select public.current_rol()) = 'admin')
    )
  );

create policy "venta_detalle_insert" on venta_detalle
  for insert to authenticated
  with check (
    exists (
      select 1 from ventas v
      where v.id = venta_detalle.venta_id
        and (v.usuario_id = (select auth.uid()) or (select public.current_rol()) = 'admin')
    )
  );

create policy "pagos_select" on pagos
  for select to authenticated
  using (
    exists (
      select 1 from ventas v
      where v.id = pagos.venta_id
        and (v.usuario_id = (select auth.uid()) or (select public.current_rol()) = 'admin')
    )
  );

create policy "pagos_insert" on pagos
  for insert to authenticated
  with check (
    exists (
      select 1 from ventas v
      where v.id = pagos.venta_id
        and (v.usuario_id = (select auth.uid()) or (select public.current_rol()) = 'admin')
    )
  );

-- =========================================================================
-- 6. ÍNDICES (columnas usadas por policies de RLS y joins frecuentes)
-- =========================================================================

create index productos_categoria_id_idx on productos (categoria_id);
create index variantes_producto_id_idx on variantes (producto_id);
create index movimientos_variante_id_idx on movimientos_inventario (variante_id);
create index movimientos_usuario_id_idx on movimientos_inventario (usuario_id);
create index cortes_caja_usuario_id_idx on cortes_caja (usuario_id);
create index ventas_usuario_id_idx on ventas (usuario_id);
create index ventas_corte_id_idx on ventas (corte_id);
create index venta_detalle_venta_id_idx on venta_detalle (venta_id);
create index venta_detalle_variante_id_idx on venta_detalle (variante_id);
create index pagos_venta_id_idx on pagos (venta_id);

-- =========================================================================
-- 7. GRANTS (tabla accesible sólo a usuarios autenticados; RLS filtra filas)
-- =========================================================================

grant usage on schema public to authenticated;
grant select, insert, update on perfiles to authenticated;
grant select, insert, update, delete on categorias, productos, variantes to authenticated;
grant select, insert on movimientos_inventario to authenticated;
grant select, insert, update on cortes_caja to authenticated;
grant select, insert, update on ventas to authenticated;
grant select, insert on venta_detalle to authenticated;
grant select, insert on pagos to authenticated;
grant usage on all sequences in schema public to authenticated;

-- =========================================================================
-- 8. BOOTSTRAP DEL PRIMER ADMIN
-- =========================================================================
-- Este INSERT no se puede ejecutar como `authenticated` (la policy exige que
-- ya exista un admin). Créalo desde el SQL Editor de Supabase (rol postgres,
-- que sí puede saltarse RLS), después de crear el usuario en Auth:
--
-- insert into perfiles (id, nombre, rol)
-- values ('<uuid-del-usuario-en-auth.users>', 'Hugo', 'admin');
