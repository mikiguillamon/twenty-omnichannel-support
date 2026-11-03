# Omnichannel Support for Twenty CRM

**Open-source support console for Twenty CRM (MIT).** Cases, messages, FAQs, channels, human evaluations and dashboards are stored per workspace and accessible via Twenty's native REST/GraphQL API. Email/WhatsApp delivery and AI bots remain external integrations such as n8n.

**Status:** beta source available; npm and Marketplace distribution require the initial package registration and verified release. **Compatibility:** Twenty 2.50.x. [MIT license](LICENSE) · [Publishing instructions](docs/PUBLICACION.md)

---

# Omnichannel Support para Twenty CRM

Una aplicación open source con licencia MIT, reutilizable y configurable por workspace. Convierte Twenty en una consola de atención multicanal: **consultas, mensajes, FAQs, canales, calidad y supervisión**. Inspirada en la visión operativa de Captia Dashboard, pero sin desarrollar otro CRM.

**Versión:** `0.3.0-beta.3`  
**Compatibilidad objetivo:** Twenty `2.50.x`, SDK `2.50.0`  
**Estado:** beta open source lista para la primera publicación npm (aún no registrada en npm). Las instalaciones privadas de Twenty no cambian automáticamente.  
**Licencia:** [MIT](LICENSE) — © 2026 Just For Fun 360, S.L.

## Funciones incluidas en el código

- **Siete objetos:** FAQs, Categorías, Consultas, Mensajes, Ajustes de soporte, Canales y Evaluaciones.
- **Personas nativas de Twenty:** una persona puede tener muchas consultas; cada consulta tiene mensajes y evaluaciones.
- **Canales configurables:** cada buzón o número es una instancia independiente. Configuración y activación en Twenty; los nuevos canales empiezan desactivados.
- **Calidad:** evaluación de una consulta o mensaje, corrección propuesta y seguimiento vinculado opcionalmente a una tarea nativa.
- **Resultados independientes:** estado técnico del bot, resultado operativo de la consulta y evaluación humana.
- **Deduplicación:** índices únicos sobre claves externas de consultas y mensajes, códigos de canales y categorías y claves de ajustes.
- **Menú simplificado:** Resumen, Consultas, Canales, FAQs, Categorías, Evaluaciones y Configuración. Email, WhatsApp, Pendientes, Errores y Respuestas incorrectas son vistas guardadas, sin accesos fijos en la barra lateral.
- **Página de consulta:** pestaña de detalles, visor cronológico de mensajes y listado de evaluaciones.
- **Resumen:** indicadores y tablas nativas de pendientes/errores en una página de Twenty.
- **API:** los registros siguen siendo objetos estándar de la API REST/GraphQL de Twenty. No es necesaria una base de datos intermedia.

**Lo que NO hace automáticamente:** conectar proveedores de email, enviar mensajes, registrar llamadas o modificar workflows de n8n. Son integraciones externas; este paquete crea el destino y la experiencia de trabajo. Los indicadores y el visor dependen de que la API REST/GraphQL del workspace tenga los nombres y permisos esperados: deben probarse en el piloto.

## Instalación para clientes, sin Terminal

El código lo despliega una sola vez el proveedor. Después, los usuarios autorizados de otros workspaces de **la misma instancia de Twenty** pueden instalar la versión privada desde un **enlace de distribución**: `Settings → Developers → Apps → My apps → Distribution → Copy share link`.

Para distribución pública se usa una **GitHub Release** sobre el commit probado de `main`; `publish.yml` publicará por OIDC y provenance, usando `beta` para prereleases y `latest` para estables. **El paquete está marcado como público, pero ninguna versión llega a npm hasta realizar la primera publicación con tu cuenta o lanzar una GitHub Release con npm Trusted Publishing configurado.**

Lee [PUBLICACION.md](docs/PUBLICACION.md) para la ruta de GitHub Actions y [INSTALACION.md](docs/INSTALACION.md) para el piloto. La mayoría de instalaciones por cliente se hacen desde la interfaz, no desde la consola.

## Primeros pasos para el desarrollador

Necesitas Node.js `24.5+`, Yarn `4.13`, acceso a npm y un workspace de prueba en Twenty 2.50.x.

```bash
corepack enable
corepack yarn install
corepack yarn check
corepack yarn test
```

`check` ejecuta verificaciones estructurales, el typecheck del SDK y el build. La beta anterior pasó el build real y las pruebas en GitHub Actions. Ejecuta siempre estos controles sobre el commit de cada versión; antes de publicar también se requiere `corepack yarn release:check` y la comprobación del artefacto.

## Documentación

- [Publicación e instalación desde UI/Marketplace](docs/PUBLICACION.md)
- [Instalación piloto](docs/INSTALACION.md)
- [Contrato API / n8n](docs/INTEGRACION_N8N.md)
- [Modelo y arquitectura](docs/ARQUITECTURA.md)
- [Operativa diaria](docs/OPERATIVA.md)
- [Dashboard nativo](docs/DASHBOARD.md)
- [Seguridad y privacidad](docs/SEGURIDAD.md)
- [Checklist de validación](docs/CHECKLIST_PILOTO.md)

## Referencia de producto

Captia Dashboard: https://github.com/mikiguillamon/captia-dashboard  
Se toman de referencia su separación de estado técnico/resultado/evaluación, supervisión y drill-down; no se copia su stack Rails ni su sistema multitenant o autenticación.

## Configurar canales por workspace

Abre **Atención al cliente → Canales**. La pantalla permite crear, pausar, desactivar y marcar como activos los canales del cliente. El estado no activa o detiene n8n por sí solo. Lee [CONFIGURACION_CANALES.md](docs/CONFIGURACION_CANALES.md) antes de conectar tus automatizaciones.

## Proceso de releases npm

El procedimiento canónico está en `50 Knowledge/Development/Publicacion npm - Estandar GitHub Actions Twenty n8n` del Second Brain. Para este repositorio consulta [PUBLICACION.md](docs/PUBLICACION.md): GitHub Release (`published`) activa `publish.yml`, sin `PUBLISH` manual y sin Environment npm obligatorio. Un push en GitHub no publica en npm: hace falta una GitHub Release y autenticación npm configurada.
