# Publicar y actualizar Omnichannel Support

Esta guía describe un proceso repetible para distribuir la app a través de Twenty y npm. Los resultados de cada release pertenecen al historial de GitHub Releases y al changelog, no a los pasos de publicación.

## Preparación

1. Comprobar la compatibilidad declarada en `package.json` (`engines.twenty`) y conservar los identificadores universales de la app.
2. Revisar licencia MIT, `README.md`, `CONTRIBUTING.md`, `LICENSE`, `CHANGELOG.md`, metadatos y capturas. El README se publica como descripción del Marketplace: debe estar dirigido a usuarios y contener URLs absolutas que funcionen también fuera de GitHub.
3. Instalar dependencias con `corepack yarn install --immutable`.
4. Ejecutar `corepack yarn release:check`, `corepack yarn check` y `corepack yarn test`.
5. Inspeccionar `.twenty/output/manifest.json`, el tarball y el contenido del paquete. Comprobar que incluye `LICENSE` y que excluye secretos y datos privados.
6. Probar la versión en un workspace o instancia aislada antes de actualizar una instalación operativa.

## Distribución privada

El propietario de la aplicación puede publicar una distribución privada desde el workflow de GitHub Actions correspondiente, con las credenciales de despliegue configuradas como secretos de Actions. Desde la interfaz de Twenty, copiar el enlace de distribución de la aplicación y abrirlo en el workspace autorizado. Las nuevas versiones deben actualizar la instalación existente cuando el proceso sea compatible; no desinstalar para probar una actualización.

La transición de una distribución privada a una app pública de npm requiere probar la identidad de la aplicación en otra instancia. Compartir `universalIdentifier` entre orígenes de distribución puede ocasionar conflictos. No sustituir una instalación que contiene datos sin una prueba de migración.

## Configurar npm Trusted Publishing

En npm, para el paquete correspondiente, configurar GitHub Actions como Trusted Publisher con:
- Propietario y repositorio GitHub exactos.
- Workflow `publish.yml` en `.github/workflows/`.
- Nombre de Environment vacío, salvo que el workflow utilice uno configurado deliberadamente.
- Permisos de publicación directa cuando se utilice `npm publish` mediante el CLI de Twenty.

La GitHub Action necesita `id-token: write`, un runner compatible alojado en GitHub y una versión de npm compatible con OIDC. Para gestionar dist-tags con OIDC se requiere npm CLI **11.21.0 o posterior**, además del permiso independiente **Allow npm dist-tag** en la configuración Trusted Publisher de `publish.yml`. Si la conexión ya existía, comprueba su permiso; npm permite añadir otra conexión autorizada al mismo workflow si hace falta. No elimines la conexión actual sin comprobar primero que la nueva puede publicar. No introducir un `NPM_TOKEN` de escritura innecesario. Para el primer registro del nombre npm, seguir el procedimiento oficial de bootstrap o staged publishing que admita el registro.

## Crear una release

Desde el repositorio, con `gh` autenticado:

```bash
git switch main
git fetch origin
git pull --ff-only origin main
corepack yarn install --immutable
corepack yarn release:check
corepack yarn check
corepack yarn test
VERSION="$(node -p "require('./package.json').version")"
TAG="v$VERSION"
node scripts/release-preflight.mjs --public --tag "$TAG"
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
git diff --quiet && git diff --cached --quiet
SHA="$(git rev-parse HEAD)"
```

Confirmar que la versión es nueva, que CI está en verde y que el tag no existe ya en remoto. Para una versión preliminar:

```bash
gh release create "$TAG" --target "$SHA" --title "$TAG" --generate-notes --prerelease --latest=false
```

Para una versión estable, omitir las opciones de prerelease solo después de validar los criterios de estabilidad. El workflow `publish.yml`, activado por `release.published`, vuelve a comprobar versión, tag, pruebas, compilación, manifiesto y paquete. La app utiliza una **política específica**: las prereleases se publican en `beta` y, una vez completada la publicación, se promocionan también a `latest` con `npm dist-tag add`. Las versiones estables se publican directamente en `latest`. Esto permite que Twenty detecte la beta como versión predeterminada en npm. La promoción requiere el permiso OIDC de dist-tags y puede fallar independientemente de la publicación; comprobar siempre las etiquetas al finalizar. No ejecutar `npm publish` desde la raíz del repositorio porque el CLI de Twenty prepara el paquete distribuible.

## Verificar

```bash
gh run list --workflow publish.yml --limit 5
npm view <NOMBRE_PAQUETE> versions --json
npm view <NOMBRE_PAQUETE> dist-tags --json
```

Sustituir `<NOMBRE_PAQUETE>` por el identificador npm real. Confirmar procedencia (provenance), integridad del tarball, visibilidad en Twenty y una instalación de prueba. En este proyecto se espera que **`beta` y `latest` apunten a la nueva beta** después de cada publicación preliminar. `latest` también se utiliza para instalaciones npm sin versión indicada, por lo que esta decisión afecta a todos los usuarios; no generalizarla a otros paquetes sin autorizarla. Para promover una versión ya publicada, utilizar **Actions → Publish Omnichannel Support to npm → Run workflow**, indicar `version` (por ejemplo `0.3.0-beta.8`) y verificar `npm view twenty-omnichannel-support dist-tags --json`. Como alternativa, un mantenedor autenticado puede ejecutar `npm dist-tag add twenty-omnichannel-support@0.3.0-beta.8 latest`. No hace falta volver a publicar la versión. Si no se puede usar OIDC, revisar **Allow npm dist-tag** antes de crear tokens. El catálogo de Twenty 2.50 se sincroniza cada hora; se puede adelantar desde el CLI con remoto válido o mediante `yarn command:prod marketplace:catalog-sync` dentro del servidor.

## Errores habituales

- **Error OIDC o de autenticación:** revisar nombre de owner, repositorio, workflow, Environment y permisos del Trusted Publisher.
- **Versión ya existente:** npm no permite sobrescribir versiones publicadas. Comprobar tags y usar una versión nueva después de diagnosticar.
- **No aparece en Marketplace:** comprobar `twenty-app`, `engines.twenty`, sincronización del catálogo, filtros, dist-tags npm (`beta` frente a `latest`) y propiedad. Un HTTP 503 al ejecutar `dev:catalog-sync --remote` indica una indisponibilidad de la petición remota; no repetir la publicación npm por ese motivo.
- **Falta LICENSE:** comprobar el artefacto real, no solo el árbol fuente. El empaquetado Twenty puede necesitar un paso específico que copie la licencia a `.twenty/output`.
- **Colisión entre instalación privada y pública:** reproducir en instancia aislada y preparar migración; no desinstalar una app con registros activos como primera reacción.

## Referencias

- [Publicación de apps en Twenty](https://docs.twenty.com/developers/extend/apps/operations/publishing)
- [Trusted Publishing de npm](https://docs.npmjs.com/trusted-publishers/)
- [GitHub CLI, crear release](https://cli.github.com/manual/gh_release_create)
- [Instalación y actualización](INSTALACION.md)
- [Validación de la integración](CHECKLIST_PILOTO.md)
