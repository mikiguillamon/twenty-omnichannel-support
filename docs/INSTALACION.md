# Instalación piloto — Omnichannel Support 0.3.0-beta.1

## Requisitos

- Twenty CRM 2.50.x; un workspace piloto distinto de `jff`.
- `space.justforfun.es`, el workspace piloto y el TLS correctamente enrutados en Coolify/Traefik. Un registro DNS wildcard **no configura Traefik por sí solo**.
- Propietario de la app con permiso **Developers / Workspace Apps**.
- Node 24.5+ solo en el entorno de build o GitHub Actions; los **clientes no necesitan Node/Yarn**.
- Verificado: el despliegue de Twenty estaba operativo y registraba dos workspaces activos, aunque el nombre del segundo no ha sido confirmado.

## 1. Crear repo y validar en Actions

Seguir `docs/PUBLICACION.md`. Subir el proyecto a un repositorio nuevo y esperar a que el workflow `Verify Omnichannel Support` termine correctamente. Si falla el build del SDK, **no publicar**: corregir el error reportado y repetir.

## 2. Primera publicación privada

Configurar `TWENTY_DEPLOY_URL` (variable) y `TWENTY_DEPLOY_API_KEY` (secret) en GitHub, correspondientes al workspace propietario. Ejecutar desde **Actions → Deploy private app to Twenty** con `DEPLOY`. Este es el único paso que sube el paquete; NO despliega Twenty ni reinicia Coolify.

## 3. Instalar desde Twenty UI

En el workspace propietario, obtener **Distribution → Copy share link**. Abrir el enlace dentro del workspace piloto e instalar desde la interfaz. Verificar los siete objetos y las vistas bajo `Atención al cliente`.

## 4. Pruebas básicas con datos ficticios

1. Crear un Canal `Email - Pruebas` con `code=email-test`, tipo EMAIL, proveedor Test, estado ACTIVE.
2. Crear una Categoría `Información` con `code=informacion`, habilitada.
3. Crear una FAQ en borrador; marcarla publicada y comprobar que aparece en FAQs publicadas.
4. Crear una Persona de ejemplo.
5. Crear una Consulta vinculada a Persona, Categoría y Canal; rellenar `channel=EMAIL` y `externalKey=EMAIL:test:thread-001`.
6. Crear un Mensaje entrante y uno saliente. En el saliente, comprobar la diferencia entre `draftBody` y `body`, y poner `deliveryStatus=SENT` solo si hubo envío de prueba realmente confirmado.
7. Abrir la ficha de Consulta y comprobar las pestañas Detalles, Conversación y Evaluaciones.
8. Crear una Evaluación INCORRECT y relacionarla con la Consulta o un Mensaje, con comentario y corrección propuesta. Comprobar la vista Respuestas incorrectas.
9. Actualizar el estado de una Consulta a HUMAN_REQUIRED y su technicalStatus a ERROR. Comprobar las vistas Pendientes de agente y Errores técnicos.
10. Abrir `Resumen` y comprobar que los contadores corresponden con los datos de prueba. Si muestra error, revisar permisos y consultas GraphQL con el Playground.
11. Repetir llamadas de prueba por API con la misma externalKey; verificar que la restricción de unicidad evita duplicaciones.
12. Probar con usuario operativo limitado para asegurarse de que no accede a datos restringidos.

## 5. Conectar n8n

Crear una **API key diferente** con permiso mínimo para leer FAQs/Configuración/Canales y crear/actualizar Consultas/Mensajes/Evaluaciones. Verificar los endpoints del workspace en **Settings → Developers → API**, no asumir nombres de campos de relaciones sin comprobación. Consultar `INTEGRACION_N8N.md`.

No cambiar ni activar flujos n8n existentes sin revisar antes la correspondencia y hacer pruebas controladas.

## 6. Hito de salida del piloto

- GitHub CI verde (typecheck, build y tests), publicación privada aceptada.
- Instalada en el workspace piloto sin Terminal.
- Vistas y UI funcionan en claro/oscuro.
- API de CRUD, relaciones y claves externas verificada.
- KPI y listado con datos reales de prueba, sin falsos ceros.
- Roles revisados; sin acceso cruzado entre workspaces.
- Confirmado rollback (publicar parche de versión o desinstalar en piloto sin borrar registros en producción).

Antes de dar acceso a un cliente real, aplicar políticas de privacidad y retención.
