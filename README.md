# laymon-sorteo

Sorteo de intercambio de regalos de Laymon Pizzería Artesanal. **Servicio aparte**: no comparte repo, servidor, base de datos ni llaves con Track (`laymon-track-propio`) ni con la web (`laymon-web`).

Cada persona se registra con su correo (verificado con un código), escribe su lista de deseos y saca su nombre en su celular. Nadie ve lo que no le toca. Los datos de quien se registra quedan guardados para contactarlo después (con su aviso de privacidad y la opción de no recibir promociones).

## Quién hace qué

- **Organizador** (`/<número>/organizador`): entra con el número de sorteo y su clave. Mete los nombres, reglas de exclusión, límite de gasto y fecha; ve quién se registró y quién ya sorteó; recibe un correo cada vez que alguien sortea; para ver quién le regala a quién se le pide un código nuevo a su correo, con una advertencia.
- **Invitado** (`/<número>`): elige su nombre en la lista, se registra (nombre completo, edad, género, correo, teléfono), verifica el correo, escribe su lista de deseos y sortea **una sola vez**. El nombre queda oculto con un ojito.
- **Cualquiera sin evento** (`/nuevo`): crea su propio sorteo, verifica su correo y recibe número y clave.
- **Laymon** (`/admin`, con `ADMIN_KEY`): crea sorteos de eventos de Laymon (entrega número y clave al organizador), ve cómo va cada uno y baja los contactos en CSV.

## Cómo reparte sin atorarse

Cada nombre se saca al azar entre los que quedan, pero antes de entregarlo se comprueba (emparejamiento perfecto) que con los nombres restantes todavía se pueda cerrar el círculo respetando las reglas. Así nunca se queda alguien sin pareja ni con un nombre prohibido. Detalle en `lib/sorteo.ts`.

## Variables (ver `.env.example`)

| Variable | Para qué |
| --- | --- |
| `ADMIN_KEY` | clave de `/admin` |
| `SORTEO_SECRET` | firma las sesiones |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | base de datos (una **nueva**, solo del sorteo) |
| `RESEND_API_KEY` | envío de códigos y avisos |
| `SORTEO_REMITENTE` | p. ej. `Laymon <sorteo@laymonpizzeria.com>`; con el dominio verificado en Resend |
| `SORTEO_BASE_URL` | dominio público para los enlaces de los correos |

Sin Resend con dominio verificado, el remitente de prueba solo manda a la cuenta dueña: los invitados no recibirían su código.

## Desarrollo

```
npm install
ADMIN_KEY=prueba SORTEO_SECRET=prueba npm run dev
npm test
```

En desarrollo, sin `RESEND_API_KEY`, los códigos se escriben en la consola del servidor.

## Datos personales

El aviso de privacidad (`app/privacidad/page.tsx`) es un borrador sin revisión legal. Antes de anunciar el sorteo hay que confirmar el nombre legal del responsable y revisarlo.
