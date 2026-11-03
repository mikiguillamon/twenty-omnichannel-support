# Distribución sin consola para cada cliente

El objetivo es crear una vez, publicar desde GitHub Actions y permitir que cada cliente instale Omnichannel Support desde la **interfaz de Twenty**. Hay dos rutas distintas.

## Opción A — Privada, recomendada para el piloto

**Primera configuración de GitHub (una sola vez):**

1. Crear un repositorio nuevo para el proyecto, por ejemplo `mikiguillamon/twenty-app-omnichannel-support`. **Mantener privado** durante el piloto.
2. Subir el contenido descomprimido de este ZIP a la raíz del repo. Comprobar que `.github/workflows/` está incluido. Puedes utilizar el editor de GitHub o una sola carga inicial desde tu entorno de desarrollo.
3. Elegir un **workspace propietario/desarrollador** controlado por tu empresa. Recomendable que no sea el de un cliente final. En un piloto puedes usar un workspace de pruebas controlado por ti y planificar la transferencia de propiedad antes de vender la app. No instales en `jff` sin querer.
4. En ese workspace, crear una API key con los permisos necesarios para publicar apps. No utilizar la clave de Meta Lead Sync ni la de integración n8n.
5. GitHub → repositorio → **Settings → Secrets and variables → Actions**:
   - **Variable** `TWENTY_DEPLOY_URL`: URL completa del workspace propietario, por ejemplo `https://soporte-dev.space.justforfun.es` (solo un ejemplo, no crear ese dominio automáticamente).
   - **Secret** `TWENTY_DEPLOY_API_KEY`: API key del workspace propietario.
6. Opcional, recomendado: GitHub → Settings → Environments → crear `private-deployment` con aprobación previa.
7. En **Actions → Deploy private app to Twenty → Run workflow** escribir `DEPLOY`. El workflow instala dependencias, valida el código y **publica el tarball en el servidor**. No instala la app automáticamente en los clientes.

**Instalación por el cliente (sin Terminal):**

1. En Twenty, dentro del workspace propietario: **Settings → Developers → Apps → My apps**.
2. Abrir `Omnichannel Support` → pestaña **Distribution** → **Copy share link**.
3. Abrir el enlace desde el workspace del cliente (la URL compartida utiliza el dominio base del servidor). La persona con permiso de administración instala la app mediante los controles de la UI de Twenty.
4. Comprobar que aparece el menú `Atención al cliente` y los siete objetos.
5. Generar una nueva API key del **cliente** para su integración con n8n. Nunca reutilizar la clave del desarrollador.

**Actualizaciones:** aumentar la versión (ej. `0.3.0-beta.1` a `0.3.0-beta.2`), lanzar de nuevo GitHub Actions y revisar actualizaciones en **Settings → Applications**. Se puede habilitar auto-upgrade si se han probado las migraciones.

**Importante:** una publicación privada **no aparece en el marketplace público**, aunque se instala mediante enlace/UI en otros workspaces del mismo servidor.

## Opción B — Marketplace Twenty / npm

Ruta posterior a la validación y revisión comercial:

1. Decidir explícitamente licencia, política de privacidad, soporte, versión estable y si el repositorio será público. Este paquete está marcado `private: true` y `UNLICENSED`: **bloquea intencionadamente su publicación npm desde el workflow**.
2. Para Marketplace con reclamación de propiedad mediante GitHub, el repositorio debe ser **público** y la versión de npm debe llevar procedencia verificable (*provenance*).
3. Cambiar `package.json` a `private: false`, fijar nombre/version y crear una **GitHub Release** desde la interfaz con tag `vX.Y.Z` que coincida con la versión del paquete. Al crear el tag se dispara el workflow de publicación, sujeto a la aprobación del Environment `npm-publication`.
4. Configurar en npm **Trusted Publisher** con tu repositorio y workflow `publish-marketplace.yml`. La publicación inicial puede requerir una habilitación/registro manual de propiedad del nombre de paquete.
5. Al crear la Release, el workflow `Publish Twenty Marketplace package` se ejecuta automáticamente desde el tag (canal `beta` por defecto); también permite ejecución manual sobre un tag escribiendo `PUBLICAR`. El workflow usa el flujo oficial `twenty app:publish` y emite provenance cuando está disponible.
6. Tras la sincronización del catálogo (normalmente horaria), la app será elegible para el Marketplace. Las comunitarias pueden requerir desactivar **Vetted only**.
7. En el workspace propietario, completar **Settings → Developers → Apps → Claim an application → Claim with GitHub**. Para servidores self-hosted, este flujo puede requerir configurar en Twenty los OAuth `APP_CLAIM_GITHUB_CLIENT_ID` y `APP_CLAIM_GITHUB_CLIENT_SECRET` con callback bajo `SERVER_URL`. No introducir esos valores en este repositorio.
8. A partir de ahí, los clientes podrán instalar desde **Settings → Applications → Marketplace**. La insignia *Vetted* depende de Twenty y no se obtiene automáticamente publicando.

No publicamos a npm en beta sin probar toda la app, las políticas de datos y el ciclo de actualización.

## Qué NO hacer

- No publicar desde un workspace cliente sin decidir quién será propietario de la app.
- No hacer un `npm publish` normal sobre la carpeta raíz: usar el workflow del SDK Twenty.
- No compartir secretos en archivos, logs o documentación.
- No establecer despliegue automático a producción en cada `git push`; el flujo de producción se ejecuta de forma explícita.
- No exponer datos entre workspaces; la aplicación es multiinstancia, pero sus registros son locales a cada workspace.

## Fuente oficial verificada

Documentación Twenty SDK `2.50.0`: `packages/twenty-docs/developers/extend/apps/operations/publishing.mdx` en el tag `twenty/v2.50.0` del repositorio `twentyhq/twenty`.
