# Instalación y validación de Omnichannel Support

## Requisitos

- Una instancia de Twenty dentro del rango declarado en `engines.twenty` del paquete.
- Permisos para instalar aplicaciones en el workspace de destino.
- Una versión publicada y disponible de la aplicación, o un enlace de distribución privada proporcionado por su propietario.
- Un workspace de pruebas separado de los datos reales para validar la actualización o la primera instalación.
- Para integrar n8n, una API key independiente del workspace y un nodo Twenty cuya compatibilidad con objetos personalizados se haya comprobado. La app por sí sola no sincroniza comunicaciones.

No es necesario instalar Node.js o Yarn en el equipo de cada usuario de Twenty. Son herramientas de desarrollo y empaquetado.

## Instalación desde la interfaz

1. Abrir las aplicaciones o el Marketplace desde Twenty, con una cuenta autorizada.
2. Localizar Omnichannel Support y comprobar la compatibilidad de su versión. Si se utiliza una distribución privada, abrir el enlace proporcionado por el propietario de la aplicación desde el workspace de destino.
3. Instalar la aplicación. Confirmar que aparecen Consultas, Canales, FAQs, Categorías, Evaluaciones, Configuración, Identidades externas, Alias de identidad y Resumen.
4. Crear una Persona ficticia y un Canal de prueba que comience desactivado. Abrir **Canales → Gestión de consultas** y guardar su política.
5. Crear una Categoría y una FAQ en `DRAFT`, después publicarla y comprobar que puede filtrarse por `PUBLISHED`.
6. Crear una Consulta relacionada con la Persona y el Canal, y dos Mensajes ficticios, uno `INBOUND` y otro `OUTBOUND`. Registrar `SENT` únicamente si se produjo un envío de prueba realmente aceptado.
7. Comprobar las relaciones y el historial desde la ficha de Consulta.
8. Crear una Evaluación relacionada con el Mensaje correspondiente. Probar la vista de respuestas incorrectas.
9. Comprobar las vistas de pendientes humanos y errores técnicos mediante los estados de Consulta.
10. Verificar Resumen, permisos de usuarios operativos y aislamiento entre workspaces.

## Conectar n8n

1. Configurar una credencial Twenty en n8n con permisos mínimos para el workspace.
2. Comprobar que el nodo Twenty admite las operaciones necesarias sobre los objetos personalizados y sus relaciones. El API Playground de Twenty permite verificar el esquema.
3. Configurar el proveedor del Canal y un flujo que resuelva identidad externa y sus alias, Persona (si procede), Consulta y Mensaje con las reglas del Canal. Para email, mantener las respuestas dentro del hilo correspondiente.
4. Probar deduplicación, confirmaciones, ecos, pausas, reintentos y escalados con datos ficticios.
5. Activar el Canal desde Twenty después de las pruebas; el workflow debe respetar el estado y comprobarlo otra vez antes de cada envío.

Consulta [INTEGRACION_N8N.md](INTEGRACION_N8N.md) y [CHECKLIST_PILOTO.md](CHECKLIST_PILOTO.md) para el procedimiento completo.

## Actualizaciones y reversión

Actualizar desde Twenty cuando haya una versión compatible, conservando los datos existentes. Comprobar el cambio previamente en un workspace o instancia aislada, en particular cuando cambia el origen de instalación entre distribución privada y catálogo público. No desinstalar la versión anterior como método habitual de actualización.

Verificar después de actualizar los nueve objetos, las relaciones, el historial, las vistas, los permisos, el nodo de n8n y una operación de prueba. Ante una regresión, detener los envíos automáticos y preparar una reversión compatible con el esquema de datos y la política de copias de seguridad, sin asumir que desinstalar restaura automáticamente el estado anterior.
