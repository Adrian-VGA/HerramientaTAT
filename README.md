# HerramientaTAT

Aplicación privada para registrar clientes, ubicaciones y visitas.

## Respaldos portables

En la aplicación, «Exportar respaldo» descarga JSON con `format: "herramienta-tat"`, `version: 1`, `exportedAt`, `clients` y `visits`. Conserva identificadores, códigos, nombres, barrios, notas, coordenadas, estados y fechas de visita. El recorrido corresponde al historial de visitas; no es una grabación continua de GPS.

«Importar respaldo» valida el archivo y muestra un resumen antes de guardar. Combina clientes por identificador o código (sin distinguir mayúsculas), conserva la ficha local en coincidencias y reasigna las visitas al cliente existente. Las visitas se deduplican por identificador; un identificador con datos contradictorios cancela toda la importación. Se guardan clientes y visitas juntos en una sola escritura. La aplicación reconoce automáticamente los datos de la versión anterior, sin borrar sus claves originales.

Para una futura página, implementar el mismo formato o convertir el JSON: cambiar de dirección o navegador no mueve los datos automáticamente. El respaldo contiene datos de clientes y ubicaciones, por lo que debe guardarse de forma privada.

## Cercanía

Activa «Mi ubicación» para ordenar los clientes por distancia y destacar el más cercano dentro del barrio seleccionado. La distancia es en línea recta, no por calles. Elige un nombre o marcador para enfocar el mapa y ver «Cómo llegar», que abre Google Maps con el destino. La ubicación se actualiza cuando se pulsa el botón.
