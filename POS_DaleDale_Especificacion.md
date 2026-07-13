# Especificación Técnica — Sistema de Punto de Venta "Dale, dale!!"

## 1. Objetivo

Construir un sistema de Punto de Venta (POS) web para "Dale, dale!!", tienda de piñatas y artículos de fiesta, para uso en computadora fija en el mostrador. El sistema debe cubrir: catálogo con variantes, control de inventario, ventas con métodos de pago mixtos, cortes de caja, y reportes.

## 2. Repositorio

Repo nuevo en GitHub: **`dale-dale-pos`** (siguiendo el patrón de `sima-apizaco`).

## 3. Stack técnico

- **Frontend:** React 18 + Vite
- **Backend/DB:** Supabase (Postgres + Auth + Row Level Security)
- **Hosting:** Vercel
- **Estilo:** Tailwind CSS
- Seguir el mismo patrón de arquitectura usado en el proyecto SIMA (Contexts para estado global, RLS por rol, funciones SECURITY DEFINER donde aplique).

## 4. Roles y usuarios

Dos roles vía Supabase Auth + tabla `perfiles`:

- **admin** (Hugo): acceso total — catálogo, inventario, cortes de caja de cualquier usuario, reportes, gestión de usuarios.
- **cajero** (1-2 empleados): solo pantalla de venta, apertura/cierre de su propia caja, historial de sus propias ventas.

```sql
create table perfiles (
  id uuid primary key references auth.users(id),
  nombre text not null,
  rol text not null check (rol in ('admin','cajero')),
  activo boolean default true,
  created_at timestamptz default now()
);
```

## 5. Modelo de datos

```sql
-- Categorías (piñatas, dulces, globos, decoración, etc.)
create table categorias (
  id serial primary key,
  nombre text not null,
  activo boolean default true
);

-- Producto "padre" (ej. "Piñata Elefante")
create table productos (
  id serial primary key,
  categoria_id int references categorias(id),
  nombre text not null,
  descripcion text,
  activo boolean default true,
  created_at timestamptz default now()
);

-- Variantes (tamaño, color, tema) — cada una con su propio stock y precio
create table variantes (
  id serial primary key,
  producto_id int references productos(id) on delete cascade,
  sku text unique,
  tamano text,
  color text,
  tema text,
  precio numeric(10,2) not null,
  costo numeric(10,2),
  stock int not null default 0,
  stock_minimo int default 3,
  activo boolean default true
);

-- Movimientos de inventario (entradas por compra, salidas por merma/ajuste)
create table movimientos_inventario (
  id serial primary key,
  variante_id int references variantes(id),
  tipo text check (tipo in ('entrada','salida','ajuste')),
  cantidad int not null,
  motivo text,
  usuario_id uuid references perfiles(id),
  created_at timestamptz default now()
);

-- Ventas
create table ventas (
  id serial primary key,
  folio text unique, -- ej. DD-000123
  usuario_id uuid references perfiles(id),
  corte_id int references cortes_caja(id),
  subtotal numeric(10,2) not null,
  descuento numeric(10,2) default 0,
  total numeric(10,2) not null,
  estado text default 'completada' check (estado in ('completada','cancelada')),
  created_at timestamptz default now()
);

-- Detalle de venta
create table venta_detalle (
  id serial primary key,
  venta_id int references ventas(id) on delete cascade,
  variante_id int references variantes(id),
  cantidad int not null,
  precio_unitario numeric(10,2) not null,
  subtotal numeric(10,2) not null
);

-- Pagos por venta (permite pago mixto: parte efectivo + parte tarjeta)
create table pagos (
  id serial primary key,
  venta_id int references ventas(id) on delete cascade,
  metodo text check (metodo in ('efectivo','tarjeta','transferencia')),
  monto numeric(10,2) not null
);

-- Cortes de caja
create table cortes_caja (
  id serial primary key,
  usuario_id uuid references perfiles(id),
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
  estado text default 'abierta' check (estado in ('abierta','cerrada')),
  notas text
);
```

**Regla clave:** `ventas.corte_id` amarra cada venta a la caja abierta en ese momento. No se puede vender sin una caja abierta (`estado = 'abierta'`) para el usuario en turno.

## 6. Pantallas

### 5.1 Login
Login con Supabase Auth (email + password). Redirige según rol.

### 5.2 Apertura de caja (obligatoria antes de vender)
- Captura `efectivo_inicial` (fondo de caja).
- Crea registro en `cortes_caja` con `estado = 'abierta'`.
- Si ya hay una caja abierta para ese usuario, la retoma.

### 5.3 Pantalla de venta (POS)
- Buscador de productos (por nombre, categoría o SKU).
- Al seleccionar producto, mostrar sus variantes disponibles (tamaño/color/tema) con stock visible.
- Carrito: cantidad editable, subtotal en tiempo real, opción de descuento (%o monto, requiere confirmación si es alto).
- Validación: no permite vender más del stock disponible.
- Pago: permite dividir el total entre efectivo / tarjeta / transferencia (uno o varios métodos). Si hay efectivo, calcula el cambio.
- Al confirmar: descuenta stock, inserta en `ventas` + `venta_detalle` + `pagos`, genera folio consecutivo, muestra/imprime ticket.

### 5.4 Inventario (admin)
- CRUD de categorías, productos y variantes.
- Alertas visuales cuando `stock <= stock_minimo`.
- Registro de entradas (compra de mercancía) y ajustes manuales, todo queda en `movimientos_inventario`.

### 5.5 Cierre de caja
- Muestra resumen calculado: total de ventas del turno, desglose por método de pago, efectivo esperado = `efectivo_inicial + total_efectivo`.
- Cajero cuenta el efectivo físico y lo captura → sistema calcula `diferencia`.
- Cierra el corte (`estado = 'cerrada'`, `fecha_cierre = now()`).

### 5.6 Reportes (admin)
- Ventas por día/semana/mes (gráfica + tabla).
- Productos/variantes más vendidos.
- Ventas por método de pago.
- Ventas y diferencias de caja por empleado.
- Histórico de cortes de caja con detalle.

## 7. Identidad visual

Usar la identidad de marca ya desarrollada para Dale, dale!! (logo del burrito piñata, tipografía redondeada bold, tagline "¡No pierdas el tino!").

**Paleta de marca** (extraída del logo oficial):

| Uso | Color | Hex |
|---|---|---|
| Azul marino (texto principal, headers, sidebar) | Navy | `#14315C` |
| Coral/salmón (acentos, botones primarios, precios) | Coral | `#F26A5C` |
| Amarillo dorado (alertas, destacados, exclamación) | Dorado | `#F5B942` |
| Verde menta (éxito, confirmaciones, detalles) | Menta | `#7AC4B6` |
| Crema (fondo general) | Crema | `#FAF3E6` |

Tipografía: usar una fuente redondeada/geométrica bold para títulos (similar al estilo del logo, ej. Poppins o Baloo 2) y una sans-serif limpia para texto general (ej. Inter).

Logo del burrito piñata disponible para usarse como ícono/favicon y en pantalla de login.

## 8. Fases de implementación sugeridas

1. **Fase 1:** Esquema de base de datos + Auth + roles + RLS básico.
2. **Fase 2:** CRUD de catálogo (categorías, productos, variantes) + inventario.
3. **Fase 3:** Pantalla de venta + carrito + pagos mixtos + descuento de stock.
4. **Fase 4:** Apertura/cierre de caja.
5. **Fase 5:** Reportes y dashboard.
6. **Fase 6:** Pulido visual con marca real + impresión de tickets.

## 9. Notas de seguridad (RLS)

- `cajero` solo puede leer/escribir sus propias ventas y su propio corte de caja.
- `cajero` no puede editar catálogo ni ver reportes globales.
- `admin` tiene acceso total vía política RLS separada.
- Nunca borrar ventas; solo marcar `estado = 'cancelada'` (mantener trazabilidad).
