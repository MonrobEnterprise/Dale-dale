-- Separa "código de barras" (dato del fabricante, se repite entre variantes
-- distintas — ej. personajes surtidos bajo un solo código — y puede venir
-- como "S/S" cuando no hay código) del "sku" interno (identificador único
-- generado por el sistema, usado para búsquedas y reportes).
--
-- El catálogo real de Hugo mostró que el `sku unique` original no aguanta
-- estos datos: reutiliza el mismo código de barras en filas distintas.

-- 1. La columna `sku` original pasa a ser `codigo_barras`: mismo dato, deja
--    de ser unique (y de ser NOT NULL de facto vía constraint).
alter table variantes
  rename column sku to codigo_barras;

alter table variantes
  drop constraint variantes_sku_key;

-- 2. `sku` interno: columna nueva, la genera el sistema.
alter table variantes
  add column sku text;

-- Backfill de las variantes existentes con un identificador interno propio.
update variantes
  set sku = 'DD-' || lpad(id::text, 6, '0')
  where sku is null;

alter table variantes
  alter column sku set not null;

alter table variantes
  add constraint variantes_sku_key unique (sku);

-- Autogenera el sku interno en altas nuevas cuando no se manda explícito
-- (importador y alta manual dejan de mandarlo). `new.id` ya está resuelto
-- en un trigger BEFORE INSERT porque el default de la serial se aplica
-- antes de que corran los triggers.
create or replace function public.generar_sku_variante()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sku is null then
    new.sku := 'DD-' || lpad(new.id::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger trg_generar_sku_variante
  before insert on variantes
  for each row
  execute function public.generar_sku_variante();

-- `codigo_barras` ya no es unique, pero lo sigue consultando el lector de
-- USB en Punto de Venta — se indexa igual (no como PK de negocio).
create index variantes_codigo_barras_idx on variantes (codigo_barras);
