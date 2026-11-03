# Publicación de Omnichannel Support — GitHub Releases, npm y Twenty

Este repositorio sigue la guía canónica del Second Brain: `50 Knowledge/Development/Publicacion npm - Estandar GitHub Actions Twenty n8n.md`. El registro de decisiones de este proyecto vive aquí, no en la nota genérica de Knowledge.

## Estado del proyecto

- Paquete npm candidato: `twenty-omnichannel-support`. **No hay publicación npm verificada todavía.**
- Versión del código candidata: `0.3.0-beta.3`; la app instalada anteriormente puede tener otra versión.
- Se conservan todos los identificadores universales de Twenty.
- `private: true` y `UNLICENSED` bloquean intencionadamente la salida pública hasta aprobar la estrategia de comercialización.
- El workflow privado `deploy-private.yml` es independiente de npm y requiere ejecutarse desde Actions con `DEPLOY`; no desinstala ni instala apps en otros workspaces.
- El workflow público `.github/workflows/publish.yml` se dispara **solo al publicar una GitHub Release** y usa npm Trusted Publishing + OIDC, sin token npm ni Environment obligatorio.
- No ejecutar el paso público hasta haber probado en un Twenty aislado la coexistencia/migración de la versión privada y la versión importada por catálogo npm: comparten `universalIdentifier`, por lo que pueden colisionar en la misma instancia.

## Fase A. Publicación privada dentro de la misma instancia Twenty

1. Confirmar CI en verde sobre `main` y versión SemVer nueva.
2. GitHub → Actions → **Deploy private app to Twenty** → seleccionar `main`, escribir `DEPLOY`.
3. En el workspace propietario (JFF): `Settings → Developers → Apps → My apps → Omnichannel Support → Distribution`.
4. Copiar enlace de instalación y abrirlo en el workspace de destino, con permisos para instalar apps.
5. Actualizar desde `Settings → Applications` cuando aparezca una versión superior; **no desinstalar la versión anterior**.
6. Validar siete objetos, canales, resumen, API y permisos en un workspace piloto antes de producción.

## Fase B. Configuración para primera publicación en npm

**Decisiones humanas pendientes:**

1. Confirmar nombre npm definitivo `twenty-omnichannel-support` y que la cuenta npm posee o puede registrar ese nombre. La búsqueda web no garantiza disponibilidad; verificar con `npm view twenty-omnichannel-support version`.
2. Decidir licencia y condiciones reales de redistribución. Para Marketplace público es necesario hacer público el paquete; no seleccionar MIT automáticamente si se quiere software propietario. `UNLICENSED` no es una estrategia comercial completa.
3. Validar privacidad/retención, permisos, documentación en inglés, compatibilidad Twenty y capturas reales de la app.
4. Probar instalación npm en **otra instancia limpia**, separado del registro privado de Twenty.
5. Preparar npm Trusted Publishing: propietario GitHub `mikiguillamon`, repo `twenty-omnichannel-support`, workflow **`publish.yml`**, **Environment vacío**, permisos de publicación directa habilitados. No introducir `NPM_TOKEN` ni contraseñas en GitHub. Si el paquete aún no existe en npm, podría requerir un primer bootstrap autenticado o staged publishing; comprobar la opción disponible antes de hacerlo.
6. Para OIDC/npm, publicación en runner alojado por GitHub. El workflow incluye `id-token: write`.

**Requisitos técnicos que bloquean la primera salida pública:**

- Cambiar `private` a `false` en `package.json` solo cuando se apruebe el lanzamiento público.
- Conservar `src/constants/ids.ts` y `src/application-config.ts` universalIdentifier.
- Actualizar licencia, README y CHANGELOG con el modelo comercial elegido.
- Conseguir CI verde, preflight público, build y revisión de `.twenty/output/manifest.json` y tarball.
- No publicar ni sincronizar npm sobre el mismo registro privado de la instancia JFF hasta validar la transición.

## Fase C. Publicar una GitHub Release

Una vez **aprobada** la publicación y configurado Trusted Publisher:

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

git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null && {
  echo "Ya existe esta etiqueta: revisa antes de continuar"; exit 1;
}
```

La Release se crea en una sola acción desde la terminal, sin etiquetar previamente:

```bash
SHA="$(git rev-parse HEAD)"
gh release create "$TAG" --target "$SHA" --title "$TAG" --generate-notes --prerelease --latest=false
```

Para una versión estable, omitir `--prerelease --latest=false`, después de validar versión y política de soporte. No reutilizar etiquetas de versiones publicadas.

**Publicar la Release inicia automáticamente `publish.yml`**, que verifica tag, rama, preflight, build y distribuye con `corepack yarn twenty app:publish --tag beta` para prereleases o sin tag para versiones estables. Usa el CLI de Twenty para empaquetar la app; **no usar `npm publish` desde la raíz**.

## Fase D. Verificar en npm y Twenty

```bash
gh run list --workflow publish.yml --limit 5
npm view twenty-omnichannel-support versions --json
npm view twenty-omnichannel-support dist-tags --json
```

Confirmar provenance y que el paquete publicado tiene manifiesto, funciones y frontend esperados. En Twenty el catálogo se sincroniza aproximadamente cada hora; las apps comunitarias pueden requerir desactivar `Vetted only`. La reclamación de la app en el workspace propietario se hace en `Settings → Developers → Apps → Claim an application → Claim with GitHub` con procedencia GitHub. En servidores self-hosted puede requerir credenciales OAuth para la reclamación. No tocar todavía el registro privado de producción.

## Si algo falla

- `PUBLICATION BLOCKED: private=true`: intencional, falta autorizar modelo de distribución.
- `ENEEDAUTH` o error OIDC: comprobar correspondencia owner, repo y `publish.yml`, ausencia de Environment a ambos lados, publicación directa permitida y estado de Trusted Publisher.
- `version already exists`: nunca sobrescribir una versión npm ni duplicar una release; consultar dist-tags y registros antes de modificar nada.
- `Marketplace no muestra la app`: comprobar keyword `twenty-app`, compatibilidad `engines.twenty`, catalog sync, filtros y propiedad.
- Error de instalación en instancia con tarball privado: no desinstalar datos; reproducir en instancia aislada y preparar transición específica de identidad.

## Referencias

- Guía canónica del vault: `50 Knowledge/Development/Publicacion npm - Estandar GitHub Actions Twenty n8n.md`
- Twenty: https://docs.twenty.com/developers/extend/apps/operations/publishing
- npm: https://docs.npmjs.com/trusted-publishers/
