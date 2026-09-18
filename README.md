# HerramientaTAT

Aplicación privada para registrar clientes, ubicaciones y visitas.

## Respaldos portables

En la aplicación, «Exportar respaldo» descarga JSON con `format: "herramienta-tat"`, `version: 1`, `exportedAt`, `clients` y `visits`. Conserva identificadores, códigos, nombres, barrios, notas, coordenadas, estados y fechas de visita. El recorrido corresponde al historial de visitas; no es una grabación continua de GPS.

«Importar respaldo» valida el archivo y muestra un resumen antes de guardar. Combina clientes por identificador o código (sin distinguir mayúsculas), conserva la ficha local en coincidencias y reasigna las visitas al cliente existente. Las visitas se deduplican por identificador; un identificador con datos contradictorios cancela toda la importación. Se guardan clientes y visitas juntos en una sola escritura. La aplicación reconoce automáticamente los datos de la versión anterior, sin borrar sus claves originales.

Para una futura página, implementar el mismo formato o convertir el JSON: cambiar de dirección o navegador no mueve los datos automáticamente. El respaldo contiene datos de clientes y ubicaciones, por lo que debe guardarse de forma privada.

## Cercanía

Activa «Mi ubicación» para ordenar los clientes por distancia y destacar el más cercano dentro del barrio seleccionado. La distancia es en línea recta, no por calles. Elige un nombre o marcador para enfocar el mapa y ver «Cómo llegar», que abre Google Maps con el destino. La ubicación se actualiza cuando se pulsa el botón.


## Búsqueda y siguiente pendiente

El buscador filtra por nombre, código y barrio, sin distinguir mayúsculas ni tildes. Las palabras se combinan y se respeta el barrio seleccionado. La lista aparece automáticamente al buscar.

«Siguiente cliente pendiente» solicita GPS actualizado y selecciona el pendiente más cercano dentro de los filtros. «Marcar visitado y continuar» conserva el historial y selecciona el siguiente usando una lectura GPS recién obtenida para la visita. Si no hay GPS, no inventa distancias; si no quedan pendientes, muestra el estado final. Los visitados no vuelven a pendientes automáticamente al cambiar de día.

Al registrar un cliente se pide una nueva lectura GPS; se guardan los valores numéricos completos y la precisión reportada, sin redondear el dato guardado. La exactitud física depende del dispositivo y la señal.


## Cierre de la fase operativa

- GPS en vivo optativo mediante watchPosition, con detener y limpieza al salir; no garantiza seguimiento con pantalla bloqueada o aplicación en segundo plano. Actualiza distancias y marcador sin mover el mapa en cada lectura.
- El registro fija el punto al abrir el formulario; requiere código, nombre y barrio. Las observaciones son opcionales. Los clientes antiguos sin barrio se conservan.
- Marcar visitado requiere un GPS recién obtenido y guarda fecha, hora y coordenadas; si falla no se registra una visita incompleta. Volver a pendiente conserva la fecha de última visita y el historial.
- Base local IndexedDB: clientes y visitas en una transacción. Migración de localStorage sin borrar el original. Una escritura detecta cambios de otra pestaña y solicita recarga en vez de sobrescribirlos.
- Menú y filtros Todos/Pendientes/Visitados combinados con barrio y búsqueda.
- Por implementar: fuente de polígonos de barrios, detección del barrio actual, resaltado de límites y cambio automático de barrio. La sincronización en la nube es una fase distinta.
