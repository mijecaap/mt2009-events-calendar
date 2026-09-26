# MT2009 Events Calendar

Calendario web de eventos de Metin2 para el server **MT2009** (mt2009.uk).
Sitio estático: HTML + CSS + JS vanilla (sin framework ni bundler).

- **Fuente de datos:** `https://mt2009.uk/api/events/list` (API pública, CORS abierto → fetch directo desde el navegador).
- **Zona horaria:** por defecto **Lima (UTC-5)**, con toggle a **hora del servidor (UTC+3)**.
- **Intensidad:** EXP/Item/Yang usan `value0`; Rueda de la Fortuna y Cajas Luz de Luna usan `value3` (2% → `2% ⭐`).

## Local

```bash
python3 -m http.server 4321        # → http://127.0.0.1:4321
```

## Tests

```bash
node --test
```

## Deploy

App Coolify `mt2009-events` (build pack **dockerfile**, puerto 80), dominio
`https://mtevents.webparatunegocio.pe/`.
