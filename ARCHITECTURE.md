# Arquitectura mínima — Clientes GPS MVP

## Decisiones

- **Interfaz:** React + TypeScript + Vite. Interfaz adaptable al celular con manifiesto y caché básica; la instalación debe verificarse en cada navegador.
- **Mapa:** Leaflet con teselas públicas de OpenStreetMap. No usa API key en este MVP.
- **Ubicación:** API de geolocalización del navegador; se solicita al pulsar el botón correspondiente. El usuario puede activar o detener el seguimiento en vivo mientras mantiene la página activa.
- **Datos:** IndexedDB, encapsulado por `LocalClientRepository`. Clientes y visitas sobreviven al cierre del navegador en el mismo dispositivo. El arranque migra el guardado anterior y conserva las claves originales de localStorage.

## Capas

```text
App / componentes de interfaz
        ↓
servicios: ubicación, cálculo de distancias
        ↓
repositorio de clientes (interfaz ClientRepository)
        ↓
IndexedDB local hoy → API/sincronización en una fase futura
```

Los clientes conservan barrio, estado y fecha de última visita. Clientes y visitas se guardan juntos en una transacción IndexedDB; cada visita tiene su propio identificador y referencia al cliente. El respaldo JSON versionado permite moverlos a una versión compatible.

## Límites del MVP

La clasificación de barrio es manual; aún no dibuja ni detecta límites geográficos. Tampoco incluye autenticación, sincronización entre dispositivos ni cálculo de rutas por calles dentro de la aplicación. «Cómo llegar» abre Google Maps. Para producción se recomienda un backend con autenticación y una fuente de teselas con una política adecuada al volumen esperado.

## Publicación

El proyecto incluye un flujo de GitHub Pages. Al publicar cambios en `main`, el flujo ejecuta pruebas y genera el sitio. La construcción usa rutas relativas, por lo que funciona tanto en una página de proyecto (`usuario.github.io/repositorio`) como en una página de usuario.
