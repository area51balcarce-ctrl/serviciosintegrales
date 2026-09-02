# SERVICIOS INTEGRALES - ESTADO DE CUENTA V1

## Objetivo
CUIL + Organismo -> Estado de cuenta -> Créditos vigentes -> Detalle de cuotas.

## Archivos
- index.html
- styles.css
- app.js
- connector.js

## Importante
La interfaz V1 está lista y no inventa datos.
La integración futura con Creditan queda aislada exclusivamente en `connector.js`.

## Datos esperados por la interfaz
El conector deberá devolver nombre, CUIL, organismo y créditos vigentes con:
- solicitud
- operación
- capital
- cuotas
- valor cuota
- próximo período
- saldo capital
- detalle de cuotas
