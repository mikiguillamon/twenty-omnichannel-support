# Publicar y actualizar Omnichannel Support

Esta guía describe un proceso repetible para distribuir la app a través de Twenty y npm. Los resultados de cada release pertenecen al historial de GitHub Releases y al changelog, no a los pasos de publicación.

## Preparación

1. Comprobar la compatibilidad declarada en `package.json` (`engines.twenty`) y conservar los identificadores universales de la app.
2. Revisar licencia MIT, `README.md`, `LICENSE`, `CHANGELOG.md`, metadatos y capturas.
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

La GitHub Action necesita `id-token: write`, un runner compatible alojado en GitHub, y versiones de Node/npm que admitan OIDC. No introducir un `NPM_TOKEN` de escritura innecesario. Para el primer registro del nombre npm, seguir el procedimiento oficial de bootstrap o staged publishing que admita el registro.

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

Para una versión estable, omitir las opciones de prerelease solo después de validar los criterios de estabilidad. El workflow `publish.yml`, activado por `release.published`, vuelve a comprobar versión, tag, pruebas, compilación, manifiesto y paquete, y publica con el CLI Twenty (`corepack yarn twenty app:publish --tag beta` para prereleases, sin `--tag beta` para estables). No ejecutar `npm publish` desde la raíz del repositorio porque el CLI de Twenty prepara el paquete distribuible.

## Verificar

```bash
gh run list --workflow publish.yml --limit 5
npm view <NOMBRE_PAQUETE> versions --json
npm view <NOMBRE_PAQUETE> dist-tags --json
```

Sustituir `<NOMBRE_PAQUETE>` por el identificador npm real. Confirmar procedencia (provenance), integridad del tarball, etiqueta `beta` o `latest`, visibilidad en el catálogo según los criterios de Twenty y una instalación de prueba. Un paquete publicado en npm no aparece necesariamente inmediatamente en todos los catálogos.

## Errores habituales

- **Error OIDC o de autenticación:** revisar nombre de owner, repositorio, workflow, Environment y permisos del Trusted Publisher.
- **Versión ya existente:** npm no permite sobrescribir versiones publicadas. Comprobar tags y usar una versión nueva después de diagnosticar.
- **No aparece en Marketplace:** comprobar `twenty-app`, `engines.twenty`, sincronización del catálogo, filtros y propiedad.
- **Falta LICENSE:** comprobar el artefacto real, no solo el árbol fuente. El empaquetado Twenty puede necesitar un paso específico que copie la licencia a `.twenty/output`.
- **Colisión entre instalación privada y pública:** reproducir en instancia aislada y preparar migración; no desinstalar una app con registros activos como primera reacción.

## Referencias

- [Publicación de apps en Twenty](https://docs.twenty.com/developers/extend/apps/operations/publishing)
- [Trusted Publishing de npm](https://docs.npmjs.com/trusted-publishers/)
- [GitHub CLI, crear release](https://cli.github.com/manual/gh_release_create)
- [Instalación y actualización](INSTALACION.md)
- [Validación de la integración](CHECKLIST_PILOTO.md)
