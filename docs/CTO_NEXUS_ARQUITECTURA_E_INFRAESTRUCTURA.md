# NEXUS Platform — Arquitectura e Infraestructura
## Documento técnico para el CTO · Versión 1.0 · Marzo 2026

---

## Índice

1. [¿Qué es NEXUS?](#1-qué-es-nexus)
2. [Visión de negocio y propuesta de valor](#2-visión-de-negocio-y-propuesta-de-valor)
3. [Arquitectura general del sistema](#3-arquitectura-general-del-sistema)
4. [Las seis capas de la plataforma](#4-las-seis-capas-de-la-plataforma)
5. [Infraestructura real desplegada](#5-infraestructura-real-desplegada)
6. [PostgreSQL — La base de datos relacional](#6-postgresql--la-base-de-datos-relacional)
7. [Apache Kafka — El sistema nervioso de la plataforma](#7-apache-kafka--el-sistema-nervioso-de-la-plataforma)
8. [MinIO — Almacenamiento de objetos](#8-minio--almacenamiento-de-objetos)
9. [Docker — Contenedores y orquestación](#9-docker--contenedores-y-orquestación)
10. [El flujo de datos de extremo a extremo](#10-el-flujo-de-datos-de-extremo-a-extremo)
11. [Arquitectura de multi-tenancy](#11-arquitectura-de-multi-tenancy)
12. [Seguridad y autorización](#12-seguridad-y-autorización)
13. [Observabilidad y métricas](#13-observabilidad-y-métricas)
14. [El Common Data Model (CDM)](#14-el-common-data-model-cdm)
15. [Resiliencia y tolerancia a fallos](#15-resiliencia-y-tolerancia-a-fallos)
16. [Decisiones de diseño técnico clave](#16-decisiones-de-diseño-técnico-clave)
17. [Estado actual de la implementación](#17-estado-actual-de-la-implementación)

---

## 1. ¿Qué es NEXUS?

NEXUS es una plataforma de inteligencia de datos empresarial de nueva generación, diseñada para resolver uno de los problemas más costosos y persistentes en las organizaciones modernas: la fragmentación e incoherencia de los datos entre múltiples sistemas de origen.

En cualquier empresa mediana o grande, los datos de clientes, productos, transacciones y operaciones están dispersos en decenas de sistemas distintos: CRMs como Salesforce, ERPs como SAP, bases de datos PostgreSQL o MySQL propias, sistemas de gestión de pedidos, herramientas de soporte, plataformas de marketing, y muchos más. Cada uno de estos sistemas tiene su propio esquema, sus propias convenciones de nomenclatura, sus propias reglas de formato y su propio modelo de datos. Un "cliente" en Salesforce se llama de una forma, tiene ciertos campos, y se almacena de cierta manera. El mismo cliente en el ERP se llama de otra forma, tiene campos adicionales o distintos, y se referencia de manera diferente.

Esta fragmentación crea fricciones enormes: los analistas de datos pasan días o semanas haciendo reconciliación manual, los informes ejecutivos son inconsistentes, las iniciativas de inteligencia artificial fracasan porque los datos de entrenamiento son sucios o contradictorios, y los equipos de integración dedican la mayor parte de su tiempo a construir y mantener pipelines frágiles punto a punto.

NEXUS resuelve este problema de forma sistémica. La plataforma conecta automáticamente con todos los sistemas de origen de la empresa, ingesta los datos en tiempo real o en lotes, los analiza estructuralmente utilizando inteligencia artificial, los mapea a un modelo de datos unificado llamado Common Data Model (CDM), los almacena en diferentes tipos de tiendas de datos optimizadas para distintos casos de uso (búsqueda semántica, análisis de grafos, series temporales), y expone todo esto a través de APIs y una interfaz de usuario inteligente.

La plataforma no se limita a ser un simple conector ETL. NEXUS incorpora agentes de inteligencia artificial que entienden el significado semántico de los datos, proponen automáticamente cómo mapear campos nuevos al modelo unificado, detectan anomalías y derivas en los esquemas de datos, y permiten a los usuarios finales hacer preguntas en lenguaje natural sobre sus datos empresariales.

Todo esto funciona en un entorno multi-tenant, lo que significa que múltiples clientes o unidades de negocio pueden usar la misma infraestructura con garantías absolutas de aislamiento de datos. Cada tenant tiene sus propios datos, sus propias configuraciones, y sus propias reglas de gobernanza, completamente separados de los demás.

---

## 2. Visión de negocio y propuesta de valor

La propuesta de valor de NEXUS se articula en cinco dimensiones estratégicas que el CTO debe poder explicar a la dirección ejecutiva y a los clientes potenciales.

### 2.1 Reducción drástica del tiempo de integración

Tradicionalmente, integrar un nuevo sistema de origen con la plataforma de datos central de una empresa requiere semanas o meses de trabajo de ingeniería. Se necesita entender el esquema del sistema de origen, mapear manualmente los campos al modelo de destino, escribir transformaciones, validar la calidad de los datos, y mantener todo esto a medida que ambos sistemas evolucionan.

Con NEXUS, este proceso pasa de semanas a horas. Los conectores se configuran a través de la interfaz administrativa especificando las credenciales de conexión y los parámetros básicos. A partir de ahí, el Módulo 1 de NEXUS se encarga automáticamente de extraer el esquema del sistema de origen, crear un perfil estadístico de cada campo (tipo inferido, porcentaje de nulos, unicidad, valores de muestra), y comenzar a ingestar los datos.

El Módulo 2 de NEXUS, el motor de inteligencia artificial estructural, analiza automáticamente ese esquema y sugiere los mapeos al CDM. Un analista de gobernanza solo necesita revisar y aprobar esas sugerencias, no crearlas desde cero.

### 2.2 Calidad de datos continua y automatizada

NEXUS no solo integra datos una vez, sino que los monitoriza continuamente. El Sistema de Detección de Deriva de Esquemas (Schema Drift Detector) compara cada nueva extracción con la versión anterior y alerta automáticamente cuando detecta cambios: un campo que desaparece, un campo nuevo que aparece, un tipo de dato que cambia de texto a número, un aumento inusual en la cantidad de valores nulos, o una caída en la unicidad de un campo que debería ser único.

Estas alertas se transforman en propuestas de gobernanza que pasan por un proceso de revisión y aprobación antes de afectar el modelo unificado. Esto significa que la calidad de los datos mejora de forma continua y sistemática, con trazabilidad completa de cada decisión.

### 2.3 Inteligencia artificial integrada en el flujo de datos

La plataforma no trata la inteligencia artificial como una capa separada que se aplica después de que los datos han sido procesados. En NEXUS, la IA es parte intrínseca del pipeline de datos. Cada registro que fluye por el sistema pasa por mecanismos de clasificación semántica, mapeo inteligente, generación de embeddings vectoriales, y escritura en tiendas de datos optimizadas para consultas de IA.

Esto significa que cualquier dato que entre en NEXUS está automáticamente disponible para búsqueda semántica, análisis de grafos de relaciones, y análisis de tendencias temporales, sin necesidad de construir pipelines adicionales.

La interfaz de usuario incluye un módulo de chat con IA que permite a los usuarios hacer preguntas en lenguaje natural directamente sobre sus datos empresariales, con respuestas generadas por el motor RHMA que combina múltiples agentes especializados.

### 2.4 Gobernanza de datos empresarial

NEXUS incluye un sistema completo de gobernanza de datos que permite a las organizaciones controlar exactamente cómo evolucionan sus modelos de datos, quién aprueba los cambios, con qué nivel de confianza se realizan los mapeos automáticos, y qué auditoría queda registrada de cada decisión.

Esto es especialmente relevante para empresas en sectores regulados (financiero, salud, seguros) donde la gobernanza de datos no es opcional sino un requisito de cumplimiento normativo.

### 2.5 Arquitectura preparada para escala empresarial

NEXUS está construido desde el primer día con una arquitectura que puede escalar desde un pequeño proyecto piloto hasta una implantación empresarial de gran escala. Los componentes son sin estado (stateless), se comunican a través de Kafka para garantizar durabilidad y replay, y están diseñados para desplegarse en Kubernetes con escalado horizontal automático.

---

## 3. Arquitectura general del sistema

La arquitectura de NEXUS sigue un principio de evento-driven (orientado a eventos). Ningún componente llama directamente a otro. Todo se comunica a través de mensajes en Apache Kafka, lo que proporciona desacoplamiento total, durabilidad de mensajes, capacidad de replay, y facilidad de escalar cada componente de forma independiente.

La arquitectura se puede visualizar en capas horizontales:

### Capa de fuentes de datos

En la parte inferior del sistema están los sistemas de origen empresariales: bases de datos PostgreSQL, CRMs de Salesforce, sistemas SAP, bases de datos MySQL, y cualquier otro sistema que tenga datos que la empresa necesita unificar. NEXUS no modifica estos sistemas de ninguna manera: solo se conecta a ellos para leer datos.

### Capa de ingesta (Módulo 1)

El Módulo 1 es el responsable de conectar con los sistemas de origen, extraer los datos, y publicarlos en el sistema de mensajería Kafka. Esta capa incluye los conectores específicos para cada tipo de sistema, el mecanismo de detección de cambios (delta detection) para no reextractar datos que no han cambiado, el escritor de datos crudos en Delta Lake (formato de almacenamiento columnar optimizado), y el clasificador que analiza semánticamente los registros para determinar qué tipo de entidad CDM representan.

### Capa de procesamiento estructural (Módulo 2 - Structural)

Esta capa analiza la estructura de los datos, crea perfiles estadísticos de los campos, detecta cambios en los esquemas, y genera propuestas de mapeo al CDM usando inteligencia artificial (Claude de Anthropic). Opera de forma continua y asíncrona, procesando los eventos del pipeline de datos.

### Capa de inteligencia ejecutiva (Módulo 2 - RHMA)

Esta es la capa más sofisticada de NEXUS. El motor RHMA (Reflective Hierarchical Multi-Agent Architecture) es un sistema de múltiples agentes de IA que trabajan en coordinación para interpretar peticiones en lenguaje natural, planificar las acciones necesarias para responderlas, ejecutar esas acciones (búsquedas, cálculos, recuperación de datos, escritura), evaluar la calidad de las respuestas a través de un Consejo de Críticos, y obtener autorización a través de Open Policy Agent antes de publicar los resultados. Este motor está implementado como un grafo de estados usando LangGraph, un framework de orquestación de agentes IA.

### Capa de escritura en tiendas AI (Módulo 3)

Una vez que los datos han sido procesados por el router de IA del Módulo 1 y clasificados por tipo de entidad, el Módulo 3 se encarga de escribirlos en las tiendas de datos especializadas: Pinecone para búsqueda vectorial/semántica, Neo4j para análisis de grafos de relaciones, y TimescaleDB para análisis de series temporales.

### Capa de gobernanza (Módulo 4)

El Módulo 4 expone una API REST construida con FastAPI (Python) que permite gestionar todo el ciclo de vida de la gobernanza de datos: crear y revisar propuestas de extensión del CDM, aprobar o rechazar mapeos de campos propuestos por la IA, consultar el estado de los trabajos de sincronización, y acceder al registro de auditoría completo.

### Capa de presentación (Módulo 6)

La interfaz de usuario es una aplicación web moderna que permite a los administradores de datos gestionar la plataforma, a los analistas revisar y aprobar propuestas de gobernanza, y a los usuarios finales interactuar con los datos a través del módulo de chat con IA.

---

## 4. Las seis capas de la plataforma

La plataforma NEXUS está organizada en módulos numerados que reflejan el orden en que los datos fluyen a través del sistema. Esta numeración es deliberada y representa una visión arquitectónica clara de las responsabilidades de cada capa.

### Módulo 1 — Data Intelligence Pipeline

El Módulo 1 es la puerta de entrada de todos los datos al sistema. Su responsabilidad es conectar con los sistemas de origen, extraer los datos de manera eficiente y sin impactar el rendimiento de los sistemas de producción, detectar qué datos han cambiado desde la última extracción, almacenar los datos crudos en formato duradero, y enrutar los datos hacia las siguientes etapas del pipeline según su tipo semántico.

Este módulo incluye un sistema de control de backpressure (presión de retorno) que evita que los sistemas de origen sean sobrecargados con extracciones demasiado agresivas. Si un sistema de origen está bajo presión, NEXUS ralentiza automáticamente la tasa de extracción.

### Módulo 2 — Structural Sub-Cycle y RHMA Executive

El Módulo 2 es el cerebro de la plataforma. Tiene dos componentes principales:

El Ciclo Estructural (Structural Sub-Cycle) analiza continuamente los esquemas de datos de las fuentes, crea perfiles estadísticos detallados de cada campo, detecta derivas en los esquemas (cambios que podrían afectar la integración), y propone automáticamente extensiones al CDM cuando encuentra datos que no encajan en el modelo actual.

El Motor Ejecutivo RHMA (RHMA Executive) es el sistema de múltiples agentes IA que procesa las peticiones en lenguaje natural de los usuarios. Recibe una intención expresada en lenguaje humano, la descompone en subtareas, ejecuta esas subtareas con trabajadores especializados, evalúa la calidad con un consejo de críticos, y entrega la respuesta final al usuario.

### Módulo 3 — AI Store Writers

El Módulo 3 es el sistema de escritura especializada. Dependiendo del tipo semántico de cada entidad de datos (partido comercial, transacción, producto, empleado, incidente), el Módulo 3 decide en qué tiendas de datos especializadas debe escribir esa entidad, y lo hace de forma idempotente (garantizando que no haya duplicados aunque el mismo dato se procese múltiples veces por fallos o reintentos).

### Módulo 4 — Governance FastAPI

El Módulo 4 expone todas las capacidades de gobernanza de NEXUS a través de una API REST bien documentada con OpenAPI. Esta API es consumida tanto por la interfaz de usuario como por herramientas de automatización y otros sistemas que necesiten interactuar con la gobernanza de datos de la plataforma.

### Módulo 5 — Reservado para futura expansión

El Módulo 5 está reservado en la arquitectura para futuras capacidades que aún están en planificación.

### Módulo 6 — Adaptive User Interface

El Módulo 6 es la interfaz de usuario. Es una aplicación web moderna construida actualmente en Angular, con planes de migrar a Next.js 14 para aprovechar las capacidades de Server-Side Rendering y el ecosistema de React con componentes de IA (React Server Components, streaming). Incluye el panel de control operacional, la consola de gobernanza, y el módulo de chat con IA.

---

## 5. Infraestructura real desplegada

Todo lo que se describe en este documento es infraestructura real que está funcionando. No hay prototipos, mockups ni simulaciones. A continuación se detalla cada componente infraestructural que está operativo.

### Resumen del estado de la infraestructura

La siguiente tabla resume todos los servicios que están activos en el entorno de desarrollo local:

| Servicio | Tecnología | Puerto | Estado |
|---|---|---|---|
| Base de datos relacional | PostgreSQL 17 | 5432 | Activo y con datos |
| Message broker | Apache Kafka (Confluent) | 9092 | Activo con 18 topics |
| Almacenamiento de objetos | MinIO | 9100 / 9101 | Activo |
| API REST principal | NestJS (Node.js) | 3000 | Activo |
| API de gobernanza | FastAPI (Python) | 8000 | Implementado |
| Interfaz de usuario | Angular | 4200 | Activo |
| Motor de agentes IA | Python (LangGraph) | - | Implementado |

---

## 6. PostgreSQL — La base de datos relacional

PostgreSQL 17 es la base de datos relacional central de NEXUS. Almacena todos los metadatos operativos: la configuración de los tenants y sus conectores, el historial de trabajos de sincronización, las propuestas de modificación del CDM, las revisiones de mapeos de campos, el registro de auditoría inmutable, y las versiones del Common Data Model.

### El esquema nexus_system

Todo el esquema de la plataforma está contenido dentro del schema de PostgreSQL llamado "nexus_system". Este uso de schemas de PostgreSQL (no confundir con los schemas de bases de datos SQL en general) es deliberado: permite separar claramente los datos operativos de la plataforma de cualquier dato de negocio que pueda también estar en la misma instancia de PostgreSQL.

Las 12 tablas operativas que se han creado en producción son:

**Tabla tenants**: Almacena la configuración de cada cliente o unidad de negocio que usa la plataforma. Cada tenant tiene un identificador único (slug), un nombre de visualización, un plan de suscripción (starter, professional, enterprise), la versión del CDM que está usando, y un indicador de si está activo. Esta tabla es la raíz de todo el modelo de datos de la plataforma y todas las demás tablas hacen referencia a ella.

**Tabla users**: Almacena los usuarios de la plataforma con sus roles y permisos. Cada usuario está asociado a un tenant específico, tiene una dirección de correo electrónico única, un rol (admin, analyst, viewer, api_service), y un estado de activación.

**Tabla connectors**: Almacena la configuración de cada conector a un sistema de origen. Incluye el tipo de sistema (postgresql, salesforce, mysql, etc.), el nombre de host y puerto de conexión, la base de datos de destino, las credenciales de autenticación almacenadas de forma segura (cifradas), y los parámetros específicos de extracción como la frecuencia de sincronización y la estrategia de detección de cambios.

**Tabla sync_jobs**: Registra cada trabajo de sincronización ejecutado. Incluye cuándo comenzó, cuándo terminó, cuántos registros fueron extraídos y procesados, si el trabajo completó exitosamente o hubo errores, y los detalles de cualquier error encontrado. Esta tabla permite auditar completamente la historia de sincronizaciones de cualquier conector.

**Tabla schema_snapshots**: Almacena las instantáneas históricas de los esquemas de las tablas de los sistemas de origen. Cada vez que el Módulo 2 analiza el esquema de una tabla de un sistema de origen, guarda una versión del perfil estadístico de esa tabla. Estas versiones históricas son las que permiten detectar derivas de esquema: al comparar la versión actual con la anterior, el sistema puede identificar qué cambios han ocurrido.

**Tabla cdm_versions**: Almacena las diferentes versiones del Common Data Model que están activadas en la plataforma. El CDM evoluciona con el tiempo a medida que se agregan nuevas entidades y campos, y esta tabla provee la trazabilidad completa de esa evolución.

**Tabla governance_proposals**: Almacena las propuestas de modificación al CDM generadas por la IA o por usuarios humanos. Cada propuesta incluye el tipo de cambio propuesto (nueva entidad, nuevo campo, modificación de tipo), la justificación basada en los datos observados, el nivel de confianza de la IA en la propuesta, y el estado de revisión (pendiente, aprobada, rechazada).

**Tabla mapping_reviews**: Almacena las revisiones de mapeo de campos específicos. Cuando la IA propone que un campo de un sistema de origen corresponde a un campo del CDM, esa propuesta queda registrada aquí junto con el nivel de confianza y el estado de aprobación por parte de un analista humano.

**Tabla governance_queue**: Es la cola interna de trabajo de gobernanza. Actúa como una bandeja de entrada para los eventos que requieren acción por parte del sistema de gobernanza, desacoplando la detección de un evento de su procesamiento.

**Tabla audit_log**: Es el registro de auditoría inmutable de la plataforma. Cada acción significativa realizada en el sistema queda registrada aquí con el usuario que la realizó, la fecha y hora exacta, el tipo de acción, el objeto afectado, y los detalles relevantes. Este registro es inmutable: una vez escrito, no puede modificarse ni eliminarse. Esto es un requisito de cumplimiento normativo en muchos sectores.

**Tabla field_mappings**: Almacena los mapeos aprobados entre campos de sistemas de origen y campos del CDM. Esta es la tabla que define cómo se transforma cada campo de cada sistema de origen al modelo unificado.

**Tabla products**: Almacena el catálogo de productos de la plataforma, usada para demostración y testing.

### Seguridad a nivel de fila (Row-Level Security)

Una de las características de seguridad más importantes de la implementación de PostgreSQL en NEXUS es el uso de Row-Level Security (RLS), una característica de PostgreSQL que permite filtrar automáticamente las filas que un usuario o proceso puede ver en función de su contexto de sesión.

En NEXUS, cuando un proceso del backend establece una conexión a PostgreSQL, inmediatamente ejecuta una instrucción que establece la variable de sesión "app.tenant_id" con el identificador del tenant con el que está trabajando. Las políticas de RLS de cada tabla filtran automáticamente para mostrar solo las filas que pertenecen a ese tenant.

Esto significa que incluso si hubiera un bug en la capa de aplicación que olvidara filtrar por tenant_id en una consulta SQL, la base de datos misma garantizaría que las filas de otros tenants no fueran visibles. Es una capa de seguridad adicional en el propio motor de base de datos.

### Índices de rendimiento

Se han creado 8 índices adicionales más allá de las claves primarias para garantizar el rendimiento de las consultas más frecuentes. Los índices más importantes son:

Un índice compuesto sobre sync_jobs(tenant_id, started_at DESC) que permite recuperar rápidamente el historial reciente de sincronizaciones de un tenant sin escanear toda la tabla.

Un índice compuesto sobre schema_snapshots(tenant_id, connector_id, source_table, snapshotted_at DESC) que permite recuperar eficientemente la última instantánea de esquema de una tabla específica.

Un índice parcial sobre governance_proposals(tenant_id, status) filtrado solo para propuestas en estado "pending" que permite a la consola de gobernanza mostrar rápidamente las propuestas pendientes de revisión.

Un índice sobre audit_log(tenant_id, created_at DESC) que permite consultar el historial de auditoría de forma eficiente.

---

## 7. Apache Kafka — El sistema nervioso de la plataforma

Apache Kafka es el componente que más distingue arquitecturalmente a NEXUS de las plataformas de integración de datos tradicionales. Kafka es un sistema de mensajería distribuida de alta velocidad, alta durabilidad, y alto rendimiento, diseñado originalmente por LinkedIn y ahora mantenido por la Apache Software Foundation.

En NEXUS, Kafka actúa como el bus central de comunicación entre todos los módulos del sistema. Ningún módulo llama directamente a otro módulo. Todo el flujo de información entre componentes pasa a través de Kafka.

### Por qué Kafka y no otras alternativas

La decisión de usar Kafka en lugar de RabbitMQ, Azure Service Bus, AWS SQS u otras alternativas de mensajería se basó en tres características únicas de Kafka:

La primera es la durabilidad y el replay. Los mensajes en Kafka no se eliminan después de ser consumidos (a diferencia de los sistemas de colas tradicionales). Los mensajes se retienen durante un periodo configurable (normalmente 7 días en producción, 30 días para topics críticos). Esto significa que si un módulo falla y necesita reprocesar los últimos N días de datos, puede hacerlo simplemente reposicionando su cursor de lectura al punto deseado. Esto es fundamental para la resiliencia del sistema.

La segunda es el rendimiento. Kafka puede manejar millones de mensajes por segundo en un clúster apropiadamente dimensionado. Para una plataforma de datos que puede estar procesando grandes volúmenes de registros de múltiples tenants simultáneamente, este rendimiento es esencial.

La tercera es la capacidad de múltiples consumidores independientes. En Kafka, un mismo mensaje puede ser consumido por múltiples grupos de consumidores de forma totalmente independiente. Esto significa que el mismo evento de "nuevos registros crudos disponibles" puede ser consumido simultáneamente por el escritor de Delta Lake, el clasificador semántico, el módulo de auditoría, y cualquier otro componente que necesite ese evento.

### Los 18 topics de Kafka de NEXUS

NEXUS utiliza exactamente 18 topics de Kafka, organizados en tres categorías:

**Topics internos del Módulo 1 (m1.int.*)**: Estos topics transportan los eventos del pipeline de ingesta de datos. El topic "m1.int.sync_requested" recibe las solicitudes de iniciar una sincronización de datos. El topic "m1.int.raw_records" transporta los registros crudos extraídos de los sistemas de origen antes de cualquier procesamiento. El topic "m1.int.delta_batch_ready" señala que un lote de registros delta (cambios detectados) está listo para procesamiento. El topic "m1.int.classified_records" transporta registros que han sido clasificados semánticamente y están listos para escribirse en las tiendas de IA. El topic "m1.int.cdm_entities_ready" señala que entidades CDM completas están listas para su uso. El topic "m1.int.ai_routing_decided" transporta las instrucciones de enrutamiento de cada registro hacia las tiendas de IA específicas. El topic "m1.int.ai_write_completed" confirma que un registro ha sido escrito exitosamente en las tiendas de IA. Los topics de error (m1.int.sync_failed, m1.int.delta_write_failed, m1.int.mapping_failed, m1.int.dead_letter) capturan los eventos fallidos en distintas etapas del pipeline. Los topics estructurales (m1.int.structural_cycle_triggered, m1.int.source_schema_extracted) señalan la disponibilidad de nuevos análisis de esquema.

**Topics del CDM lifecycle (nexus.cdm.*)**: Estos topics transportan eventos relacionados con la evolución del Common Data Model. El topic "nexus.cdm.extension_proposed" publica las propuestas de extensión del CDM generadas por los agentes IA. El topic "nexus.cdm.version_published" anuncia la publicación de una nueva versión aprobada del CDM. El topic "nexus.cdm.extension_rejected" registra las propuestas que fueron revisadas y rechazadas.

**Topics de sistema (nexus.sys.*)**: El topic "nexus.sys.audit_events" recibe todos los eventos de auditoría de toda la plataforma.

**Topics por tenant (*.m2.*)**: A diferencia de los anteriores que son topics estáticos compartidos por todos los tenants, los topics M2 son dinámicos y se crean uno por tenant. Por ejemplo, para el tenant "acme-corp", existe el topic "acme-corp.m2.semantic_interpretation_requested" donde se publican las peticiones de interpretación semántica para ese tenant, y "acme-corp.m2.semantic_interpretation_complete" donde se publican las respuestas.

### El servidor Kafka activo

El servidor Kafka que está activo en el entorno de desarrollo es el contenedor Docker llamado "mindy-kafka" que usa la imagen Confluent Platform Kafka versión 7.5.0. Está configurado en modo KRaft (sin Zookeeper), lo que significa que es un cluster de un solo nodo con el protocolo de consenso de Kafka integrado. Opera en el puerto 9092 y todos los 18 topics listados anteriormente han sido creados y configurados con los factores de replicación y el número de particiones apropiados para el volumen de carga esperado.

---

## 8. MinIO — Almacenamiento de objetos

MinIO es un sistema de almacenamiento de objetos de alto rendimiento compatible con la API de Amazon S3. En la arquitectura de NEXUS, MinIO sirve como el sistema de almacenamiento de datos en estado bruto y como el sistema de almacenamiento del lago de datos Delta Lake.

### Por qué almacenamiento de objetos

La decisión de usar almacenamiento de objetos (como S3 o MinIO) para el lago de datos en lugar de un sistema de archivos tradicional se basa en tres ventajas fundamentales.

La primera es el costo. El almacenamiento de objetos es significativamente más económico que el almacenamiento en bloque o el almacenamiento en sistemas de bases de datos relacionales, especialmente cuando se habla de volúmenes de datos grandes. Para una plataforma que puede estar almacenando años de historia de datos de múltiples fuentes de múltiples tenants, el costo de almacenamiento es una consideración crítica.

La segunda es la escalabilidad. El almacenamiento de objetos puede crecer teóricamente de forma ilimitada sin ninguna operación de reconfiguración. No hay que prever el espacio en disco ni mover datos entre sistemas cuando se alcanza el límite.

La tercera es la compatibilidad con el ecosistema de datos moderno. Apache Spark, Delta Lake, Trino, Athena, y prácticamente todas las herramientas de procesamiento de datos modernas hablan S3 de forma nativa. Al usar MinIO en desarrollo (que es S3-compatible) y S3 real en producción, la plataforma puede cambiar entre entornos sin cambiar ni una línea de código.

### La instancia MinIO activa

El contenedor Docker "nexus-minio" está activo con los siguientes parámetros: puerto 9100 para la API de S3 (acceso programático desde el código Python y NestJS), puerto 9101 para la consola web de administración (interfaz gráfica para explorar los datos), usuario "nexus" y contraseña configurada de forma segura.

---

## 9. Docker — Contenedores y orquestación

Docker es la tecnología de contenedorización que permite empaquetar cada componente de NEXUS con todas sus dependencias y ejecutarlo de forma reproducible en cualquier entorno.

### El archivo docker-compose.yml

El archivo docker-compose.yml en la raíz del proyecto de Python define todos los servicios de infraestructura que el stack de NEXUS necesita: Kafka, MinIO, y sus dependencias. Este archivo ha sido actualizado durante el desarrollo para usar la imagen oficial de Confluent Platform para Kafka en lugar de la imagen Bitnami, lo que proporciona mayor compatibilidad con el ecosistema Confluent y mejor soporte a largo plazo.

La configuración de Kafka en el docker-compose.yml usa el modo KRaft (Kafka Raft Metadata Mode), que es el nuevo modo operativo de Kafka que elimina la dependencia de Apache Zookeeper. Este modo está completamente soportado desde Kafka 3.3 y está diseñado para ser la configuración estándar en producción a partir de Kafka 4.0. Usar KRaft desde el inicio significa que no habrá que migrar la instalación en el futuro.

### Contenedores activos en producción local

Los siguientes contenedores están activos y funcionando en el entorno de desarrollo:

**mindy-kafka**: Kafka 7.5.0 (Confluent Platform) en modo KRaft. Contiene los 18 topics NEXUS. Accesible en el puerto 9092. El nombre "mindy-kafka" refleja que este contenedor kafka fue creado en un contexto previo del proyecto (MINDY) y está siendo reutilizado para NEXUS en desarrollo local.

**nexus-minio**: MinIO para almacenamiento de objetos S3. Accesible en los puertos 9100 (API) y 9101 (consola web).

### La transición a Kubernetes

En producción, todos estos contenedores Docker se despliegan en Kubernetes (K8s). La plataforma NEXUS ya incluye configuraciones de despliegue K8s para cada uno de los módulos Python (M2 SchemaProfiler, M2 RHMA Runner, M3 Orchestrator, M4 Governance API) así como para los componentes de infraestructura (Kafka via Strimzi operator, MinIO, Neo4j, Pinecone via cliente). Esta preparación para K8s desde el inicio del proyecto es una decisión arquitectónica deliberada que facilita enormemente la transición de desarrollo a producción.

---

## 10. El flujo de datos de extremo a extremo

Para entender completamente la arquitectura de NEXUS, es útil seguir el recorrido de un dato desde el momento en que existe en un sistema de origen hasta el momento en que está disponible para el usuario final. Este recorrido es lo que llamamos el "happy path" de NEXUS.

### Paso 1 — El administrador configura un conector

Un administrador de la plataforma usa la interfaz web para configurar un nuevo conector. Especifica el tipo de sistema de origen (por ejemplo, PostgreSQL), las credenciales de conexión, la base de datos y los schemas a sincronizar, la frecuencia de sincronización (por ejemplo, cada hora), y la estrategia de detección de cambios (por ejemplo, basada en columna de timestamp). Esta configuración se guarda en la tabla nexus_system.connectors de PostgreSQL.

### Paso 2 — El sistema inicia una sincronización

Cuando llega el momento de sincronizar (según la frecuencia configurada o cuando un administrador la activa manualmente), el sistema registra un nuevo sync_job en la tabla correspondiente y publica un mensaje en el topic "m1.int.sync_requested" de Kafka. Este mensaje contiene el identificador del conector y el tenant al que pertenece.

### Paso 3 — El conector extrae los datos

El Módulo 1 de NEXUS tiene un proceso que está continuamente escuchando el topic "m1.int.sync_requested". Cuando recibe un mensaje, instancia el conector apropiado (en este caso, el PostgreSQL Connector) con las credenciales guardadas, se conecta al sistema de origen, ejecuta las consultas de extracción de datos, aplica la lógica de detección de cambios para obtener solo los registros nuevos o modificados desde la última sincronización, y publica los registros extraídos en el topic "m1.int.raw_records".

### Paso 4 — Escritura en el lago de datos

Los registros en "m1.int.raw_records" son consumidos por el Delta Writer Worker, que los almacena en el lago de datos en formato Parquet columnar. Los datos se organizan de forma particionada por tenant y fecha de extracción, lo que permite consultas eficientes sobre rangos de tiempo específicos. Una vez escritos, se publica un mensaje en "m1.int.delta_batch_ready" indicando que hay un nuevo lote disponible.

### Paso 5 — Clasificación semántica

El clasificador del Módulo 1 consume los registros del lago de datos y aplica modelos de clasificación para determinar qué tipo de entidad CDM representa cada registro. ¿Es un cliente (party)? ¿Es una transacción? ¿Es un producto? Esta clasificación usa tanto reglas heurísticas (analizar el nombre de los campos, los patrones de los valores) como modelos de machine learning. Los registros clasificados se publican en "m1.int.classified_records".

### Paso 6 — Análisis estructural y propuestas de gobernanza

En paralelo con el flujo principal, el Módulo 2 Structural está continuamente monitorizando los esquemas de las tablas de origen. Extrae el perfil estadístico de cada campo (tipo inferido, porcentaje de nulos, unicidad, muestra de valores), lo compara con la versión histórica almacenada en schema_snapshots, y si detecta cambios significativos, publica un mensaje en el topic "m1.int.structural_cycle_triggered". Esto activa al Agente Estructural, que usa Claude (el modelo de IA de Anthropic) para analizar los cambios y generar una propuesta de extensión del CDM, que se publica en "nexus.cdm.extension_proposed" y se guarda en la tabla governance_proposals.

### Paso 7 — Enrutamiento hacia tiendas de IA

El router de IA del Módulo 1 recibe los registros clasificados y determina en qué tiendas de IA especializadas deben escribirse según el tipo de entidad. Las reglas son: los registros de tipo "party" (clientes, socios) van a Pinecone (búsqueda vectorial) y Neo4j (grafo de relaciones); las transacciones van a Neo4j y TimescaleDB (series temporales); los productos van solo a Pinecone; los empleados van a Pinecone y Neo4j; los incidentes van a Pinecone y TimescaleDB. Las instrucciones de enrutamiento se publican en "m1.int.ai_routing_decided".

### Paso 8 — Escritura en tiendas especializadas

El orquestador del Módulo 3 consume las instrucciones de enrutamiento y orquesta la escritura paralela en las tiendas especializadas. Para Pinecone, genera los embeddings vectoriales usando el modelo de lenguaje local "all-MiniLM-L6-v2" (no se usa ningún modelo de OpenAI: es un modelo open-source que corre localmente en la máquina). Para Neo4j, construye los nodos y relaciones usando los metadatos del registro. Para TimescaleDB, extrae el timestamp y los valores numéricos relevantes y los inserta en la tabla de series temporales.

### Paso 9 — El usuario hace una pregunta

El usuario final accede a la interfaz de chat de NEXUS y escribe una pregunta en lenguaje natural: "¿Cuáles son los clientes más activos del último trimestre en Europa?". Esta pregunta se convierte en un objeto ExecutiveRequest con el intent (la pregunta), el tenant_id del usuario, y el contexto de la sesión, y se publica en el topic per-tenant "acme-corp.m2.semantic_interpretation_requested".

### Paso 10 — El motor RHMA procesa la petición

El runner del motor RHMA está escuchando el topic de ese tenant. Al recibir la petición, inicia el grafo LangGraph que orquesta todo el proceso: el Planificador usa Claude para descomponer la intención en subtareas concretas; los Workers ejecutan esas subtareas (el SearchWorker busca en Pinecone, el CalculateWorker ejecuta agregaciones SQL, el FetchWorker recupera registros específicos); el Consejo de Críticos evalúa la calidad de la respuesta desde tres perspectivas (veracidad, coherencia y cumplimiento de políticas); finalmente, el Guardia de OPA verifica que la operación está autorizada según las políticas de la plataforma.

### Paso 11 — La respuesta llega al usuario

Si todo el proceso de evaluación y autorización es satisfactorio, la respuesta final se publica en el topic "acme-corp.m2.semantic_interpretation_complete" y la interfaz de usuario la recibe a través de WebSocket, mostrándola al usuario con la puntuación de calidad de los críticos y la latencia total del proceso.

---

## 11. Arquitectura de multi-tenancy

NEXUS es una plataforma multi-tenant diseñada desde los cimientos para soportar múltiples clientes o unidades de negocio en la misma infraestructura con garantías absolutas de aislamiento de datos.

### Aislamiento a nivel de base de datos

Cada fila de cada tabla en PostgreSQL incluye una columna tenant_id. Las políticas de Row-Level Security garantizan que ningún proceso puede ver datos de un tenant distinto al que está autenticado en la sesión. Esto se aplica a nivel del motor de base de datos, no a nivel de aplicación, lo que significa que es una garantía de seguridad mucho más robusta.

### Aislamiento a nivel de Kafka

Los topics estáticos de Kafka (los 13 topics m1.int.* y nexus.*) son compartidos entre todos los tenants, pero cada mensaje incluye el tenant_id en el envelope del mensaje. Todos los consumidores verifican el tenant_id antes de procesar un mensaje.

Los topics dinámicos por tenant (los topics *.m2.*) son totalmente separados por tenant. El topic "acme-corp.m2.semantic_interpretation_requested" solo puede ser leído por los procesos autorizados para el tenant "acme-corp".

### Aislamiento a nivel de tiendas de IA

En Pinecone, la segregación se logra mediante la convención de nombres: cada index tiene el prefijo del tenant ("nexus-acme-corp-party", "nexus-acme-corp-product"), lo que garantiza que los vectores de un tenant no pueden mezclarse con los de otro.

En Neo4j, cada nodo lleva dos labels: el tipo de entidad (Party, Transaction, etc.) y la etiqueta del tenant (Tenant_acme-corp). Las consultas siempre filtran por la etiqueta del tenant, garantizando que nunca se vean los datos de otro tenant.

### Aislamiento a nivel del motor RHMA

El Guard-in-Guard de OPA verifica en cada petición que el usuario autenticado pertenece al tenant que está consultando y que no está intentando acceder a datos de otro tenant. Si una petición intenta acceder a datos cruzados entre tenants, OPA la rechaza y el motor RHMA registra el intento en el log de auditoría.

---

## 12. Seguridad y autorización

La seguridad en NEXUS tiene múltiples capas independientes que se complementan entre sí.

### Autenticación

La autenticación en el entorno de producción está diseñada para usar Okta como proveedor de identidad mediante el protocolo OIDC (OpenID Connect) con el flujo PKCE. En el entorno de desarrollo actual, se usa autenticación JWT (JSON Web Tokens) generados localmente por el backend NestJS.

Todos los endpoints del backend NestJS requieren un token JWT válido. El NestJS Auth Guard verifica la firma del token, su expiración, y extrae el tenant_id y el rol del usuario del payload del token.

### Autorización con OPA

Open Policy Agent (OPA) es el motor de políticas de autorización de NEXUS. En producción, OPA corre como un sidecar container en cada pod de Kubernetes que necesita tomar decisiones de autorización.

Las políticas de OPA de NEXUS son reglas expresadas en el lenguaje Rego de OPA que definen: qué usuarios pueden leer datos de qué tenants, qué usuarios pueden realizar operaciones de escritura, cuáles tenants están activos, y qué combinaciones de acciones están permitidas.

El Guard-in-Guard del motor RHMA hace una llamada HTTP síncrona al sidecar de OPA antes de finalizar cualquier petición. Si OPA no responde en 2 segundos o responde con autorización denegada, el motor RHMA rechaza la petición. Esto implementa el principio de "fail-secure" (fallo seguro): en caso de duda, denegar.

### Secretos y credenciales

Las credenciales sensibles (contraseñas de base de datos, API keys de Pinecone, credenciales de Neo4j, API keys de Anthropic) se gestionan mediante Kubernetes Secrets en producción, montados como archivos en el sistema de archivos del contenedor. El código nunca lee credenciales de variables de entorno directamente (que pueden filtrarse en logs) sino desde arhcivos montados en rutas específicas del sistema de archivos.

---

## 13. Observabilidad y métricas

NEXUS tiene observabilidad integrada en todos sus componentes mediante Prometheus, el estándar de facto para métricas en aplicaciones cloud-native.

Cada componente Python del sistema expone un endpoint HTTP de métricas en su propio puerto dedicado: el SchemaProfiler en el puerto 9094, el Agente Estructural en el puerto 9095, el Runner RHMA en el puerto 9096, y el Orquestador M3 en el puerto 9097. El backend NestJS expone métricas en el puerto 3001.

Las métricas que se recopilan incluyen: el total de esquemas perfilados por tenant, el total de eventos de drift detectados por tipo y tenant, el total de propuestas CDM generadas, las latencias de las llamadas al LLM (Claude) con percentiles p50/p95/p99, el total de peticiones RHMA procesadas con su resultado (éxito, rechazado, error), las latencias end-to-end del pipeline RHMA, el total de vectores escritos en Pinecone por tenant y tipo de entidad, y el total de nodos escritos en Neo4j.

En el entorno de producción, todas estas métricas se agregan en dashboards de Grafana que permiten monitorizar la salud de la plataforma en tiempo real.

---

## 14. El Common Data Model (CDM)

El Common Data Model es el corazón conceptual de NEXUS. Es el modelo de datos unificado al que se mapean todos los datos de todos los sistemas de origen, independientemente de cómo esos datos estén estructurados originalmente en sus sistemas nativos.

El CDM de NEXUS define un conjunto de entidades empresariales estandarizadas: Party (que engloba clientes, proveedores, socios y cualquier entidad comercial), Transaction (que engloba pedidos, facturas, pagos y cualquier evento económico), Product (que engloba artículos, servicios y cualquier oferta comercializable), Employee (que engloba el personal y los recursos humanos), e Incident (que engloba eventos operativos, reclamaciones y cualquier acontecimiento que requiere seguimiento).

Para cada una de estas entidades, el CDM define un conjunto de campos estándar con nombres precisos, tipos de datos definidos y descripciones semánticas claras. Por ejemplo, en la entidad Party, el campo "party_name" siempre almacena el nombre principal del sujeto (ya sea una persona o una empresa), independientemente de que en Salesforce ese campo se llame "Account Name", en SAP "Geschäftspartner Name 1", o en la base de datos de legacy "CUST_FULL_NM".

Los mapeos entre los campos de los sistemas de origen y los campos del CDM son propuestos automáticamente por la IA con un nivel de confianza, revisados por un analista de gobernanza, y aprobados o rechazados. Una vez aprobados, los mapeos se almacenan en la tabla field_mappings y se usan para todas las sincronizaciones futuras.

---

## 15. Resiliencia y tolerancia a fallos

La arquitectura de NEXUS está diseñada para ser resiliente ante fallos parciales del sistema.

### Reintentos y dead letter queue

Cada etapa del pipeline tiene mecanismos de reintento automático con backoff exponencial para errores transitorios (fallos de red temporales, timeouts breves). Si un mensaje no puede ser procesado después de un número configurable de reintentos, no se descarta sino que se mueve al topic "m1.int.dead_letter". Este topic actúa como un depósito de mensajes problemáticos que un operador puede revisar manualmente o reenviar para reprocesamiento una vez resuelto el problema original.

### Offsets de Kafka y commits manuales

Todos los consumidores de Kafka en NEXUS están configurados con "enable.auto.commit: false", lo que significa que el consumer solo marca un mensaje como "procesado" (hace commit del offset) después de haberlo procesado exitosamente. Si el proceso falla en medio del procesamiento, el mensaje será reentregado y reprocesado cuando el consumer se reinicie. Esto garantiza que ningún dato se pierda por un fallo en medio del procesamiento.

### Idempotencia en los escritores

Todos los escritores de datos en NEXUS (el escritor de Delta Lake, el VectorWriter de Pinecone, el GraphWriter de Neo4j, el TimeSeriesWriter de TimescaleDB) están implementados como operaciones idempotentes. Esto significa que si el mismo mensaje se procesa múltiples veces por cualquier razón (Kafka garantiza "at least once delivery," no "exactly once"), el resultado final es el mismo que si se hubiera procesado una sola vez. No se crean registros duplicados.

### Backpressure

El componente de control de backpressure del Módulo 1 monitoriza continuamente la velocidad a la que el downstream (el resto del pipeline) puede procesar los mensajes. Si la cola se está acumulando, el backpressure controller reduce automáticamente la velocidad de extracción de los conectores. Esto evita el escenario en que un pico de carga en el sistema de origen provoca una cascada de fallos en el resto del pipeline.

---

## 16. Decisiones de diseño técnico clave

Estas son las decisiones técnicas más importantes que se tomaron durante el diseño de NEXUS y las razones que las justifican.

### No usar OpenAI para embeddings

La decisión de usar el modelo local "all-MiniLM-L6-v2" de sentence-transformers para la generación de embeddings en lugar de la API de embeddings de OpenAI fue intencional y se basa en tres razones: el costo (generar embeddings para millones de registros con OpenAI costaría cientos o miles de dólares al mes), la privacidad (algunos clientes no pueden enviar sus datos a APIs externas por restricciones contractuales o regulatorias), y la latencia (el modelo local genera embeddings en milisegundos sin depender de llamadas de red a APIs externas).

### LangGraph para el motor RHMA

La elección de LangGraph (de LangChain Labs) como framework de orquestación de agentes IA para el motor RHMA se basa en que es el único framework maduro que permite definir grafos de agentes con estado persistente, ramificación condicional, y ciclos (para los reintentos de planificación). La alternativa más simple de simplemente encadenar llamadas LLM en secuencia no es adecuada para un sistema de producción que necesita ser robusto ante fallos parciales.

### Anthropic Claude en lugar de GPT-4

Para las llamadas LLM que requieren capacidad de razonamiento complejo (el Planificador RHMA, el Agente Estructural), NEXUS usa Claude 3.5 Sonnet de Anthropic. Para las llamadas que requieren velocidad y menor costo (el Consejo de Críticos), se usa Claude 3.5 Haiku. Esta decisión se basa en los benchmarks de capacidad de razonamiento estructurado, que muestran que Claude es particularmente bueno para tareas que requieren seguir instrucciones complejas y producir outputs en formato JSON estructurado.

### Kafka como única interfaz inter-módulo

La decisión de prohibir llamadas directas entre módulos (no hay APIs REST internas entre módulos) y requerir que toda la comunicación pase por Kafka fue tomada para garantizar el desacoplamiento total entre módulos. Esto significa que cada módulo puede ser escalado, reiniciado, o reemplazado de forma completamente independiente sin afectar a los demás.

---

## 17. Estado actual de la implementación

Al momento de escribir este documento, la plataforma NEXUS tiene el siguiente estado de implementación:

La base de datos PostgreSQL está completamente desplegada con las 12 tablas, 8 índices, y los datos semilla iniciales. Kafka está activo con los 18 topics. MinIO está activo.

El backend NestJS está activo con autenticación JWT, todos los módulos de gobernanza implementados, y los endpoints de gestión de propuestas, revisiones de mapeo y trabajos de sincronización funcionando.

La interfaz Angular está activa con todos los componentes del dashboard operativos.

La librería Python nexus-platform v0.2.0 tiene los módulos nexus_core (comunicación y tipos de datos comunes), M1 (conectores y workers de ingesta), M2 Structural (análisis de esquemas y detección de drift), M2 RHMA (motor ejecutivo de agentes IA), M3 (escritores de tiendas IA), y M4 (API de gobernanza FastAPI) completamente implementados.

La cobertura de tests es de 140 tests automatizados todos pasando, con cobertura de todos los componentes críticos del sistema.

---

*Documento preparado para revisión del CTO — Plataforma NEXUS — Marzo 2026*
*Clasificación: Uso interno — Confidencial*
