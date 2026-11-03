# Publicación de Omnichannel Support — GitHub Releases, npm y Twenty

Este repositorio sigue la guía canónica del Second Brain: `50 Knowledge/Development/Publicacion npm - Estandar GitHub Actions Twenty n8n.md`. El registro de decisiones de este proyecto vive aquí, no en la nota genérica de Knowledge.

## Estado del proyecto

- Paquete npm elegido: `twenty-omnichannel-support`. **No hay publicación npm verificada todavía.**
- Versión del código candidata: `0.3.0-beta.3`; la app instalada anteriormente puede tener otra versión.
- Se conservan todos los identificadores universales de Twenty.
- Licencia MIT aprobada: `private: false`, `license: MIT` y `LICENSE`. Publicar una GitHub Release sigue requiriendo configurar la autenticación npm.
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

**Pendiente en npm y en las pruebas de distribución:**

1. Confirmar nombre npm definitivo `twenty-omnichannel-support` y que la cuenta npm posee o puede registrar ese nombre. La búsqueda web no garantiza disponibilidad; verificar con `npm view twenty-omnichannel-support version`.
2. Licencia aprobada: **MIT**, que permite uso comercial, modificación y redistribución con su aviso de copyright.
3. Validar privacidad/retención, permisos, documentación en inglés, compatibilidad Twenty y capturas reales de la app.
4. Probar instalación npm en **otra instancia limpia**, separado del registro privado de Twenty.
5. Preparar npm Trusted Publishing: propietario GitHub `mikiguillamon`, repo `twenty-omnichannel-support`, workflow **`publish.yml`**, **Environment vacío**, permisos de publicación directa habilitados. No introducir `NPM_TOKEN` ni contraseñas en GitHub. Si el paquete aún no existe en npm, podría requerir un primer bootstrap autenticado o staged publishing; comprobar la opción disponible antes de hacerlo.
6. Para OIDC/npm, publicación en runner alojado por GitHub. El workflow incluye `id-token: write`.

**Requisitos técnicos de la primera salida pública:**

- Completado: `private: false` y `license: MIT`.
- Conservar `src/constants/ids.ts` y `src/application-config.ts` universalIdentifier.
- Completado: licencia MIT, README y CHANGELOG actualizados.
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

- `PUBLICATION BLOCKED: private=true`: revisar un cambio accidental que haya revertido el paquete a privado.
- `ENEEDAUTH` o error OIDC: comprobar correspondencia owner, repo y `publish.yml`, ausencia de Environment a ambos lados, publicación directa permitida y estado de Trusted Publisher.
- `version already exists`: nunca sobrescribir una versión npm ni duplicar una release; consultar dist-tags y registros antes de modificar nada.
- `Marketplace no muestra la app`: comprobar keyword `twenty-app`, compatibilidad `engines.twenty`, catalog sync, filtros y propiedad.
- Error de instalación en instancia con tarball privado: no desinstalar datos; reproducir en instancia aislada y preparar transición específica de identidad.

## Referencias

- Guía canónica del vault: `50 Knowledge/Development/Publicacion npm - Estandar GitHub Actions Twenty n8n.md`
- Twenty: https://docs.twenty.com/developers/extend/apps/operations/publishing
- npm: https://docs.npmjs.com/trusted-publishers/

## Primer bootstrap de la publicación (npm)

La primera publicación requiere una sesión npm con permisos sobre `twenty-omnichannel-support`. El portal Trusted Publishing puede no mostrar la configuración para un nombre todavía no registrado.

- Comprueba con `npm view twenty-omnichannel-support version` si existe. Un 404 puede indicar que el nombre está libre, pero solo una publicación exitosa confirma la titularidad.
- Revisa el paquete generado por el SDK, su manifiesto y que no incluya secretos, datos de personas ni configuración privada.
- Si npm permite staged publishing de una primera versión, sigue el flujo oficial desde npm con 2FA. Si no, el bootstrap excepcional puede hacerse con sesión interactiva y el empaquetador correcto de Twenty: `corepack yarn twenty app:publish --tag beta`. No uses `npm publish` desde la raíz del repositorio.
- La versión `0.3.0-beta.3` solo debe publicarse una vez. Si el bootstrap ya la publicó, la siguiente Release de GitHub debe usar una versión nueva (p. ej. `0.3.0-beta.4`), nunca reutilizar el mismo número.
- Configura npm **Trusted Publishing** con GitHub owner `mikiguillamon`, repo `twenty-omnichannel-support`, workflow `publish.yml`, **Environment vacío**, y permite publicación directa (`npm publish`). Comprueba la primera publicación con provenance antes de restringir los tokens tradicionales.
- No sustituyas ni desinstales el paquete privado existente dentro de Twenty: primero prueba la versión del catálogo npm en una instancia separada.

**Licencia:** MIT, © 2026 Just For Fun 360, S.L.; el uso, la modificación y la comercialización del código están permitidos bajo sus condiciones.

## Primera publicación automatizada desde GitHub (beta.4)

1. Confirmar mediante `npm view twenty-omnichannel-support versions --json` que existe `0.3.0-beta.3` y que pertenece a la cuenta correcta.
2. En npm → Settings → Trusted Publishing, la identidad debe ser GitHub Actions / owner `mikiguillamon` / repo `twenty-omnichannel-support` / workflow `publish.yml` / Environment vacío. Debe permitir **npm publish** (no solo staged publishing).
3. Verificar CI verde del commit de `main` y revisar el tarball para no incluir credenciales ni datos personales.
4. Desde el repositorio local sincronizado, crear la GitHub Release `v0.3.0-beta.4` marcada como **prerelease**, usando los comandos de arriba. **No crear la Release si el paso 1 o 2 no está verificado.**
5. Comprobar que el workflow `publish.yml` termina en verde, npm anuncia `0.3.0-beta.4` bajo dist-tag `beta` y la versión tiene provenance. `latest` no debe apuntar a una beta.
6. No sustituir la app instalada por tarball privado sin probar la identidad en una instalación de Twenty limpia.

## Segunda publicación verificada (beta.4) y corrección MIT (beta.5)

- GitHub Release `v0.3.0-beta.4` activó `publish.yml` correctamente y el CLI confirmó npm `twenty-omnichannel-support@0.3.0-beta.4`, con dist-tag `beta` y provenance firmada.
- El empaquetador Twenty SDK 2.50 copia `README.md`, pero no incorpora por defecto `LICENSE`. Se incorpora un `prepack` en `package.json` que, desde `.twenty/output`, copia el archivo MIT original sin publicarlo desde la raíz del repositorio.
- Desde beta.5, CI y el workflow de Release comprueban `package/LICENSE` dentro del tarball. La publicación falla si la licencia está ausente, vacía o no coincide con el repositorio.
- Una nueva publicación requiere una versión nueva, CI verde en main, revisión del artefacto y una GitHub Release con `--prerelease --latest=false`. No se reutiliza `v0.3.0-beta.4`.
- La transición de una instalación privada a una app publicada por catálogo npm requiere pruebas en otra instancia. No desinstalar ni sobrescribir la app existente en JFF.
