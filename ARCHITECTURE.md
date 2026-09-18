# Arquitectura mínima — Clientes GPS MVP

## Decisiones

- **Interfaz:** React + TypeScript + Vite. Es una PWA responsive instalada desde el navegador.
- **Mapa:** Leaflet con teselas públicas de OpenStreetMap. No usa API key en este MVP.
- **Ubicación:** API de geolocalización del navegador; sólo se solicita al pulsar el botón correspondiente.
- **Datos:** `localStorage`, encapsulado por `LocalClientRepository`. Los clientes sobreviven al cierre del navegador en el mismo dispositivo.

## Capas

```text
App / componentes de interfaz
        ↓
servicios: ubicación, cálculo de distancias
        ↓
repositorio de clientes (interfaz ClientRepository)
        ↓
localStorage hoy → API/base de datos en una fase futura
```

Los clientes conservan barrio, estado y fecha de última visita. Las visitas se guardan en un registro local separado, listo para sustituirse por una API.

## Límites del MVP

La clasificación de barrio es manual; aún no dibuja ni detecta límites geográficos. Tampoco incluye autenticación, sincronización entre dispositivos o rutas. Para producción se recomienda un backend con autenticación y una fuente de teselas con una política adecuada al volumen esperado.

## Publicación

El proyecto incluye un flujo de GitHub Pages. Al publicar cambios en `main`, el flujo ejecuta pruebas y genera el sitio. La construcción usa rutas relativas, por lo que funciona tanto en una página de proyecto (`usuario.github.io/repositorio`) como en una página de usuario.
