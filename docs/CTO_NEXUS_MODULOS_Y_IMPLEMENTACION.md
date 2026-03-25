# NEXUS Platform — Módulos, Implementación y Hoja de Ruta
## Documento técnico para el CTO · Versión 1.0 · Marzo 2026

---

## Índice

1. [La librería Python nexus-platform](#1-la-librería-python-nexus-platform)
2. [nexus_core — El núcleo compartido](#2-nexus_core--el-núcleo-compartido)
3. [Módulo M1 — Data Intelligence Pipeline](#3-módulo-m1--data-intelligence-pipeline)
4. [Módulo M2 — Ciclo Estructural](#4-módulo-m2--ciclo-estructural)
5. [Módulo M2 — Motor RHMA Executive](#5-módulo-m2--motor-rhma-executive)
6. [Módulo M3 — AI Store Writers](#6-módulo-m3--ai-store-writers)
7. [Módulo M4 — Governance FastAPI](#7-módulo-m4--governance-fastapi)
8. [El backend NestJS](#8-el-backend-nestjs)
9. [La interfaz Angular](#9-la-interfaz-angular)
10. [La estrategia de testing](#10-la-estrategia-de-testing)
11. [Los scripts de infraestructura](#11-los-scripts-de-infraestructura)
12. [El plan de construcción (build plan)](#12-el-plan-de-construcción-build-plan)
13. [Próximos pasos — NEXUS-07](#13-próximos-pasos--nexus-07)
14. [Próximos pasos — NEXUS-08](#14-próximos-pasos--nexus-08)
15. [Próximos pasos — NEXUS-09](#15-próximos-pasos--nexus-09)
16. [Estimación de plazos y recursos](#16-estimación-de-plazos-y-recursos)
17. [Riesgos técnicos identificados](#17-riesgos-técnicos-identificados)
18. [Conclusión ejecutiva](#18-conclusión-ejecutiva)

---

## 1. La librería Python nexus-platform

Todo el código de procesamiento de datos, inteligencia artificial, y gobernanza de NEXUS está implementado en Python como una librería Python llamada "nexus-platform" en su versión 0.2.0. Esta librería vive en el directorio "nexus-python-platform" del repositorio.

La elección de Python como lenguaje para este componente es deliberada y se basa en la madurez del ecosistema de Python para inteligencia artificial, machine learning, y procesamiento de datos. Las librerías más importantes para estas tareas (PyTorch, TensorFlow, sentence-transformers, LangChain, LangGraph, Pinecone, Neo4j, asyncpg, confluent-kafka) tienen sus implementaciones de referencia en Python y su soporte más completo en este lenguaje.

La librería está construida con Hatchling como sistema de build (el nuevo estándar recomendado por la Python Packaging Authority), lo que facilita la publicación en un registro privado de paquetes Python y la instalación en cualquier entorno con un simple comando de pip.

La estructura interna de la librería refleja exactamente la arquitectura modular de NEXUS: hay un package Python para cada módulo de la plataforma (nexus_core, m1, m2, m3, m4), y cada package contiene los componentes funcionales de ese módulo.

El archivo pyproject.toml que configura la librería declara todas las dependencias necesarias para el funcionamiento de cada módulo. Las dependencias se organizan en grupos: las dependencias base (necesarias para todos los módulos), las dependencias de IA ("ai extras", que incluyen sentence-transformers, pinecone-client y neo4j y son opcionales en entornos donde no se necesitan las tiendas de IA), las dependencias de conectores específicos ("connectors extras", que incluyen drivers de MySQL y Salesforce), y las dependencias de desarrollo (pytest, ruff, mypy).

---

## 2. nexus_core — El núcleo compartido

El package "nexus_core" es la base sobre la que se construyen todos los demás módulos. Contiene las abstracciones y utilidades que son compartidas por todos los componentes del sistema.

### 2.1 El sistema de topics (topics.py)

El archivo topics.py contiene la clase CrossModuleTopicNamer, que es el único lugar en todo el código de NEXUS donde los nombres de los topics de Kafka están definidos. Esta es una decisión de diseño muy importante: si un nombre de topic necesita cambiar, solo hay que cambiarlo en este único lugar y todos los componentes que usan la clase lo recibirán automáticamente.

La clase CrossModuleTopicNamer expone dos tipos de acceso: los topics estáticos (compartidos por todos los tenants, accesibles como T.STATIC.RAW_RECORDS, T.STATIC.CDM_EXTENSION_PROPOSED, etc.) y los métodos para generar topics dinámicos por tenant (T.m2_request("acme-corp"), T.m2_response("acme-corp"), etc.).

El hecho de que los nombres de los 18 topics estén centralizados y que los tests incluyan pruebas específicas de que cada nombre tiene el formato correcto garantiza que nunca habrá un bug causado por una discrepancia entre el nombre del topic que usa el productor y el nombre del topic que escucha el consumidor.

### 2.2 Los tipos de datos (schemas.py)

El archivo schemas.py contiene todas las estructuras de datos que fluyen entre los componentes del sistema NEXUS. Estos tipos están implementados como dataclasses de Python con tipado explícito, lo que proporciona validación automática y documentación embebida en el código.

Los tipos más importantes son:

FieldProfile es la representación estadística de un campo de una tabla de un sistema de origen. Contiene el tenant_id al que pertenece, el sistema de origen (postgresql, salesforce, etc.), la tabla y el nombre del campo, el tipo de dato inferido automáticamente por la plataforma, si el campo acepta valores nulos, el ratio de unicidad (qué fracción de los valores son únicos), el ratio de nulos, y una muestra de valores representativos. Esta estructura es la unidad atómica del análisis de esquemas de NEXUS.

SourceKnowledgeArtifact es la descripción completa del esquema de una tabla completa. Contiene la lista de FieldProfiles de todos sus campos, así como metadatos sobre cuándo fue extraído el esquema, qué trabajo de sincronización lo generó, y qué versión del CDM estaba activa en ese momento. Esta estructura es lo que el Agente Estructural analiza para generar propuestas de extensión del CDM.

DriftEvent es la representación de un cambio detectado en el esquema de una tabla. Contiene el tipo de drift detectado (campo nuevo, campo eliminado, cambio de tipo, pico de nulos, o caída de cardinalidad), el nombre del campo afectado, el valor anterior y el valor nuevo, y un nivel de severidad (baja, media, alta). Esta estructura es generada por el SchemaDriftDetector y disparadora del ciclo de gobernanza.

RHMARequest y RHMAResponse son los tipos de datos de la interfaz pública del motor ejecutivo RHMA. Estos tipos son los que viajan por los topics de Kafka *.m2.* y definen el contrato entre el cliente que hace una petición de interpretación semántica y el motor que la procesa.

### 2.3 La mensajería (messaging.py)

El archivo messaging.py contiene las clases NexusProducer y NexusConsumer, que son los wrappers sobre la librería confluent_kafka que todos los módulos de NEXUS usan para publicar y consumir mensajes en Kafka.

NexusProducer envuelve el productor de Kafka con funcionalidad adicional específica de NEXUS: garantiza que todos los mensajes usen el envelope NexusMessage con todos los campos de trazabilidad (correlation_id, trace_id, timestamp), serializa los mensajes a JSON automáticamente, implementa callbacks de entrega para detectar fallos silenciosos de entrega, y usa la clave de partición del tenant_id para garantizar que todos los mensajes de un mismo tenant vayan a la misma partición de Kafka, preservando el orden relativo.

NexusConsumer envuelve el consumidor de Kafka con funcionalidades equivalentes: deserializa mensajes de JSON y los convierte en objetos NexusMessage tipados, gestiona los commits manuales de offsets, y ahora incluye también el método subscribe_pattern() para suscribirse a topics usando expresiones regulares, que es la forma en que el runner RHMA se suscribe al patrón "*.m2.semantic_interpretation_requested" para escuchar peticiones de todos los tenants con una sola suscripción.

### 2.4 Gestión de tenants (tenant.py)

El archivo tenant.py implementa la gestión del contexto de tenant usando Python context variables (equivalente a thread-local storage pero seguro para código async). Cuando un componente comienza a procesar un mensaje de un tenant específico, establece el contexto de tenant usando la función set_tenant(). Desde ese momento, cualquier parte del código que necesite saber con qué tenant se está trabajando puede llamar a get_current_tenant() sin necesidad de pasar el tenant_id como parámetro a través de todos los niveles de la llamada. Esto hace el código más limpio y reduce la probabilidad de bugs causados por olvidar pasar el tenant_id en algún punto.

### 2.5 Conexiones a base de datos (db.py)

El archivo db.py proporciona el context manager get_tenant_scoped_connection(), que establece una conexión a PostgreSQL y automáticamente configura la variable de sesión app.tenant_id antes de que el código de aplicación pueda ejecutar cualquier consulta. Esto garantiza que las políticas de Row-Level Security estén siempre activas sin que el desarrollador tenga que recordar establecer la variable de sesión manualmente.

---

## 3. Módulo M1 — Data Intelligence Pipeline

El Módulo 1 es el punto de entrada de todos los datos al sistema NEXUS. Implementa el pipeline completo de ingesta, desde la conexión con el sistema de origen hasta la escritura en el lago de datos y el enrutamiento hacia las tiendas de IA.

### 3.1 El sistema de conectores

Los conectores son los componentes responsables de establecer la conexión con los sistemas de origen y extraer los datos de forma eficiente. Todos los conectores heredan de la clase base BaseConnector que define el contrato que cualquier conector debe cumplir: debe poder establecer la conexión, extraer registros en batches, y detectar qué registros han cambiado desde la última extracción (extraer deltas).

La clase BaseConnector garantiza que todos los conectores compartan el mismo comportamiento en cuanto a manejo de errores, logging, y reporting de métricas, independientemente del sistema de origen específico con el que trabajan. Esto hace que el sistema sea extensible: agregar soporte para un nuevo tipo de sistema de origen solo requiere implementar los métodos abstractos de BaseConnector.

El sistema de errores de los conectores está diseñado con una jerarquía de excepciones específicas: ConnectorError es la excepción base, con subclases específicas para diferentes tipos de fallos: errores de conexión (cuando no se puede establecer la conexión), errores de autenticación (credenciales incorrectas), errores de extracción (fallos durante la lectura de datos), y errores de configuración (parámetros incorrectos). Esta jerarquía permite al sistema de gestión de errores del pipeline reaccionar de forma diferente según el tipo de fallo.

El PostgreSQL Connector es el primer conector production-ready implementado. Se conecta a cualquier base de datos PostgreSQL, puede extraer el esquema de tablas y vistas, extraer todos los registros de una tabla, y extraer de forma eficiente solo los registros que han cambiado desde un timestamp específico.

### 3.2 El sistema de credenciales

Las credenciales de conexión a los sistemas de origen son datos sensibles que deben estar protegidos. El CredentialLoader de NEXUS implementa una cadena de proveedores de credenciales: primero busca las credenciales como archivos montados en el sistema de archivos (para K8s Secrets), si no las encuentra busca en variables de entorno, y si tampoco las encuentra ahí, puede consultar AWS Secrets Manager o HashiCorp Vault si están configurados. Esta arquitectura de cadena de proveedores hace que el sistema sea usable en desarrollo local (credentials en variables de entorno) y en producción (credentials en K8s Secrets o gestores de secretos) sin cambiar el código.

### 3.3 La factory de conectores

El ConnectorFactory es el componente que, dado el tipo de sistema de origen (un string como "postgresql", "salesforce", "mysql"), instancia el conector apropiado con sus credenciales y devuelve un objeto listo para ser usado. Esta patrón Factory es lo que permite al sistema de sincronización del Módulo 1 trabajar con cualquier tipo de conector sin conocer los detalles específicos de cada uno.

### 3.4 Los workers de Kafka

Los workers son los procesos que están continuamente escuchando topics de Kafka y procesando los mensajes que llegan. El ConnectorWorker escucha el topic "m1.int.sync_requested" y, para cada mensaje, instancia el conector apropiado, ejecuta la extracción de datos, y publica los resultados en el topic "m1.int.raw_records". El DeltaWriterWorker escucha el topic "m1.int.raw_records" y escribe los registros en el lago de datos en formato Parquet.

### 3.5 El sistema de backpressure

El componente de backpressure del Módulo 1 implementa el algoritmo de control de flujo que evita que el pipeline sea sobrecargado. Monitoriza el lag de los consumidores de Kafka (cuántos mensajes están acumulados sin procesar) y si el lag supera un umbral configurable, emite señales de backpressure que reducen la velocidad de extracción de los conectores.

---

## 4. Módulo M2 — Ciclo Estructural

El Ciclo Estructural del Módulo 2 es el sistema que analiza continuamente la estructura de los datos que fluyen por el pipeline NEXUS y garantiza que el Common Data Model esté siempre actualizado y coherente con la realidad de los sistemas de origen.

### 4.1 El SchemaProfiler

El SchemaProfiler es un worker de Kafka que escucha el topic "m1.int.source_schema_extracted". Cuando llega un mensaje con el perfil de una tabla de un sistema de origen, el SchemaProfiler realiza las siguientes acciones:

Primero, normaliza los datos recibidos. Los datos vienen del sistema de origen en distintos formatos dependiendo del conector (algunos sistemas reportan el porcentaje de nulos como un número entre 0 y 100, otros como un número entre 0 y 1), y el SchemaProfiler los convierte todos al formato estándar de NEXUS.

Segundo, guarda el perfil en la tabla nexus_system.schema_snapshots de PostgreSQL como una nueva versión del esquema de esa tabla. Esto construye el historial que permite la detección de deriva.

Tercero, recupera la versión anterior del perfil de esa misma tabla (si existe) y llama al SchemaDriftDetector para comparar ambas versiones.

Si el SchemaDriftDetector detecta algún tipo de deriva, el SchemaProfiler construye un mensaje con todos los eventos de deriva detectados y lo publica en el topic "m1.int.structural_cycle_triggered", que activa la siguiente etapa del ciclo.

El SchemaProfiler corre en el puerto 9094 de Prometheus para exponer sus métricas operativas.

### 4.2 El SchemaDriftDetector

El SchemaDriftDetector es el componente analítico que compara dos versiones de un esquema de tabla y produce una lista de eventos de deriva. Es un componente puro (no tiene estado externo, no se comunica con Kafka ni con ninguna base de datos), lo que lo hace muy fácil de testear y verificar.

El SchemaDriftDetector detecta cinco tipos de deriva:

La deriva de tipo "campo nuevo" (new_field) ocurre cuando aparece un campo en el esquema nuevo que no existía en el esquema anterior. Se asigna una severidad "media" porque un campo nuevo puede ser una adición benigna del sistema de origen que solo requiere que la plataforma aprenda a mapearlo al CDM.

La deriva de tipo "campo eliminado" (removed_field) ocurre cuando un campo que existía en el esquema anterior desaparece en el nuevo. Se asigna una severidad "alta" porque esto puede indicar una ruptura de compatibilidad en el sistema de origen que podría invalidar los mapeos existentes.

La deriva de tipo "cambio de tipo" (type_changed) ocurre cuando el tipo de dato inferido de un campo cambia entre versiones. Por ejemplo, si un campo que se perfilaba como "integer" de repente tiene valores que no son enteros y se reperfiló como "string". Se asigna severidad "alta" porque puede invalidar el mapeo CDM existente.

La deriva de tipo "pico de nulos" (null_spike) ocurre cuando el ratio de nulos de un campo aumenta más del 10% entre versiones. Esto puede indicar que el sistema de origen ha empezado a no poblar ese campo, lo que puede indicar un bug o un cambio de proceso en el sistema de origen.

La deriva de tipo "caída de cardinalidad" (cardinality_drop) ocurre cuando el ratio de unicidad de un campo cae más del 25% entre versiones. Esto puede indicar degradación de calidad de datos o un cambio en la semántica del campo.

### 4.3 El M2StructuralAgent

El M2StructuralAgent es el agente de inteligencia artificial que analiza los eventos de deriva detectados y genera propuestas de extensión del CDM. Usa el modelo Claude 3.5 Sonnet de Anthropic para razonar sobre los cambios.

El agente escucha el topic "m1.int.structural_cycle_triggered" y, para cada mensaje, construye un prompt estructurado que presenta al modelo de IA el esquema actual de la tabla, los eventos de deriva detectados, los mapeos CDM que estaban aplicados, y le pide que proponga una actualización al CDM o una modificación a los mapeos existentes.

La propuesta generada por Claude incluye campos con nivel de confianza explícito para cada sugerencia. El agente inserta la propuesta en la tabla nexus_system.governance_queue para su revisión por un analista humano antes de ser aplicada, y simultáneamente publica el evento en el topic "nexus.cdm.extension_proposed" para que otros sistemas interesados puedan reaccionar.

Si el paquete de Anthropic no está instalado (por ejemplo en entornos de CI donde no se quiere hacer llamadas reales a la API), el agente opera en modo graceful degradation: registra un warning en los logs y no realiza la propuesta de gobernanza, pero tampoco falla el proceso.

El M2StructuralAgent corre en el puerto 9095 de Prometheus.

---

## 5. Módulo M2 — Motor RHMA Executive

El motor RHMA (Reflective Hierarchical Multi-Agent Architecture) Executive es el componente más sofisticado de la plataforma NEXUS. Es un sistema de múltiples agentes de inteligencia artificial que trabajan en coordinación para interpretar peticiones en lenguaje natural y responderlas usando los datos disponibles en las tiendas de IA de NEXUS.

El motor RHMA está implementado como un grafo de estados usando LangGraph, un framework de orquestación de agentes IA desarrollado por LangChain Labs. El grafo define los nodos (los agentes que realizan tareas específicas), los estados (la información que se pasa entre nodos), y las transiciones (las condiciones que determinan qué nodo se ejecuta a continuación).

### 5.1 El sistema de tipos locales (types.py)

Dado que el módulo RHMA Executive necesita sus propios tipos de datos para representar las subtareas, los resultados de los workers, y las evaluaciones de los críticos, y para evitar conflictos con los tipos de la librería nexus_core (que tiene sus propios tipos con firmas ligeramente diferentes), el módulo RHMA define sus propios tipos con el prefijo "Executive": ExecutiveWorkerType, ExecutiveSubTask, ExecutiveWorkerResult, ExecutiveCriticScore, ExecutiveRequest, y ExecutiveResponse.

La clase ExecutiveWorkerType es una enumeración que define los cuatro tipos de workers que el Planificador puede invocar: SEARCH (para consultar las tiendas vectoriales o el grafo), CALCULATE (para ejecutar cálculos o agregaciones SQL), FETCH (para recuperar datos específicos), y WRITE (para crear o actualizar registros).

### 5.2 El estado del grafo (state.py)

El RHMAState es un TypedDict de Python (un diccionario con tipado explícito de sus claves y tipos de valores) que contiene toda la información de estado que el grafo LangGraph necesita para procesar una petición. Incluye la petición original, el plan generado por el Planificador, el contador de iteraciones de planificación (para controlar los reintentos), la lista acumulada de resultados de los workers, las puntuaciones del Consejo de Críticos, el estado de autorización de OPA, la respuesta final, y los mensajes de todo el proceso para debugging.

El campo messages usa la anotación Annotated con operator.add, que es la convención de LangGraph para campos que se concatenan entre sí cuando múltiples nodos actualizan el estado simultáneamente. Esto permite a los nodos que corren en paralelo (como los tres críticos del Consejo) actualizar sus resultados de forma segura sin sobrescribirse mutuamente.

### 5.3 El Planificador (planner.py)

El nodo planificador es responsable de analizar la intención del usuario y descomponerla en un plan de subtareas concretas que los workers pueden ejecutar. El Planificador usa Claude 3.5 Sonnet para este razonamiento.

El prompt que el Planificador envía a Claude incluye el intent del usuario, el contexto de la petición, los tipos de workers disponibles, y restricciones explícitas sobre cómo debe estructurarse el plan. Claude responde con un array JSON de subtareas, cada una con un identificador, una descripción, el tipo de worker que debe ejecutarla, las dependencias con otras subtareas (para poder planificar ejecución paralela cuando no hay dependencias), y el contexto específico que el worker necesita.

El Planificador incrementa el contador de iteraciones del estado cada vez que se ejecuta, lo que permite al sistema de control del grafo determinar cuándo se han agotado los reintentos de planificación.

### 5.4 Los Workers (workers.py)

Los workers son los agentes especializados que ejecutan las subtareas del plan. Hay cuatro tipos:

El SearchWorker realiza búsquedas semánticas en Pinecone usando el vector embedding de la consulta generado con el modelo local all-MiniLM-L6-v2. Puede buscar en el índice del tenant específico y devuelve los documentos más similares con sus puntuaciones de similitud coseno.

El CalculateWorker ejecuta cálculos y agregaciones. Puede construir consultas SQL para PostgreSQL usando los parámetros especificados en el contexto de la subtarea, ejecutarlas de forma segura (con parámetros preparados para prevenir inyección SQL), y devolver los resultados de los cálculos.

El FetchWorker recupera registros específicos de las tiendas de datos. Puede recuperar registros por ID desde PostgreSQL, nodos específicos desde Neo4j, o series temporales de TimescaleDB para un rango de tiempo específico.

El WriteWorker crea o actualiza registros en las tiendas de datos. Este worker solo debe ejecutarse cuando el Planificador y el Consejo de Críticos hayan determinado que una operación de escritura es necesaria y apropiada, y solo después de que el Guard de OPA autorice la operación.

La función execute_workers_node es el nodo del grafo que coordina la ejecución de todos los workers del plan actual. Analiza las dependencias entre subtareas para identificar cuáles pueden ejecutarse en paralelo y las despacha a los workers apropiados.

### 5.5 El Consejo de Críticos (critics.py)

El Consejo de Críticos es un mecanismo de control de calidad compuesto por tres críticos que evalúan en paralelo la calidad de la respuesta producida por los workers antes de que sea entregada al usuario.

El crítico "factual" evalúa si la información en la respuesta es veraz y está respaldada por los datos recuperados por los workers. Da una puntuación entre 0 y 1 en función de si hay contradicciones internas, si los números son correctos, y si las afirmaciones están sustentadas en datos reales.

El crítico "coherence" (coherencia) evalúa si la respuesta es lógica y consistente, si aborda correctamente la petición original del usuario, y si las conclusiones se siguen de los datos presentados.

El crítico "policy" (políticas) evalúa si la respuesta cumple con las restricciones de gobernanza de datos de la plataforma: no revela información de un tenant a otro, respeta los niveles de acceso del usuario, y no incluye datos personales que no deberían estar en la respuesta.

Cada crítico usa Claude 3.5 Haiku (el modelo más ligero y económico de la familia Claude 3.5) para su evaluación, lo que garantiza que el proceso de crítica sea rápido y económico sin comprometer su fiabilidad.

El Consejo implementa una regla especial para el crítico de políticas: si este da una puntuación inferior a 0.50, tiene derecho de veto y el Consejo completo falla independientemente de las puntuaciones de los otros dos críticos. Esto es una interpretación del principio de "el incumplimiento de políticas nunca se promedia con la calidad técnica".

La puntuación media ponderada del Consejo debe superar el umbral de 0.75 para que la respuesta pase la fase de crítica.

### 5.6 El Guardia de OPA (guard.py)

El nodo guard (guardia) es la última línea de defensa antes de que la respuesta sea entregada al usuario. Se comunica con el sidecar de Open Policy Agent consultando una API REST específica con los detalles de la petición: el tenant que hace la petición, el usuario autenticado, su intención, y las acciones que los workers ejecutaron.

OPA evalúa estas entradas contra las políticas de autorización de la plataforma (escritas en el lenguaje Rego de OPA) y devuelve una decisión binaria: autorizado o denegado.

Si OPA no está disponible (timeout de 2 segundos o error de conexión), el guardia deniega la petición. Esta es la implementación del principio "fail-secure": cuando hay incertidumbre sobre la autorización, la respuesta correcta es denegar.

Se incluye un caso especial para entornos de desarrollo donde el paquete httpx no está instalado: en ese caso, el guardia auto-autoriza con un warning en los logs para facilitar el desarrollo local sin necesidad de un sidecar de OPA.

### 5.7 El grafo LangGraph (graph.py)

El archivo graph.py es donde se ensambla el grafo completo. La función build_rhma_graph() recibe un cliente de Anthropic y un diccionario de workers instanciados, registra todos los nodos en el StateGraph, define las transiciones entre nodos, y compila el grafo en un objeto ejecutable.

La topología del grafo es: el punto de entrada es siempre el nodo "plan" (el Planificador). Desde "plan" siempre se va a "execute" (los Workers). Desde "execute" siempre se va a "critics" (el Consejo de Críticos). Desde "critics" hay una transición condicional: si el Consejo pasó, se va a "guard" (OPA); si el Consejo no pasó y quedan reintentos, se vuelve a "plan"; si no quedan reintentos, se va a "reject". Desde "guard" hay otra transición condicional: si OPA autorizó, se va a "finalize"; si denegó, se va a "reject". Desde "finalize" y desde "reject" el grafo termina.

Los nodos "finalize" y "reject" están implementados en el mismo archivo. El nodo "finalize" construye el ExecutiveResponse final sintetizando la interpretación a partir de los resultados de los workers y calculando la latencia total. El nodo "reject" registra el motivo del rechazo en los logs.

Las funciones de routing _should_replan() y _should_finalize() implementan la lógica de las transiciones condicionales. Son funciones puras sin efectos secundarios, lo que las hace triviales de testear.

### 5.8 El runner de Kafka (runner.py)

El RHMARunner es el componente que conecta el motor RHMA con Kafka. Es el proceso que corre continuamente, escucha los topics de peticiones RHMA de todos los tenants, procesa cada petición a través del grafo LangGraph, y publica los resultados.

Para escuchar las peticiones de todos los tenants con una sola suscripción, el runner usa el método subscribe_pattern() de NexusConsumer con la expresión regular que casa con todos los topics que terminan en ".m2.semantic_interpretation_requested".

Cuando el runner procesa una petición exitosamente, publica la respuesta en el topic ".m2.semantic_interpretation_complete" del tenant. Si la respuesta requería operaciones de escritura (requires_workflow=True), también publica un mensaje en el topic ".m2.workflow_trigger" que puede activar un workflow de Temporal para realizar operaciones más complejas que requieren coordinación.

Si el motor rechaza la petición (por fallo de críticos o denegación de OPA), el runner publica el rechazo en el topic ".m2.semantic_interpretation_rejected" con los motivos del rechazo.

El runner expone métricas en el puerto 9096 de Prometheus: el total de peticiones procesadas por tenant y resultado (éxito, rechazado, error), y la distribución de latencias end-to-end.

---

## 6. Módulo M3 — AI Store Writers

El Módulo 3 es el sistema de escritura especializada que toma los registros clasificados del pipeline y los almacena en las tiendas de datos optimizadas para consultas de IA.

### 6.1 El VectorWriter

El VectorWriter es responsable de generar embeddings vectoriales de los registros y almacenarlos en Pinecone. Un embedding vectorial es una representación numérica del significado semántico de un texto en un espacio de alta dimensión (384 dimensiones en el caso de NEXUS). Los embeddings permiten la búsqueda semántica: encontrar documentos similares en significado aunque no compartan las mismas palabras exactas.

El VectorWriter usa el modelo "all-MiniLM-L6-v2" de sentence-transformers para generar los embeddings. Este modelo corre completamente en local, sin necesidad de llamadas a APIs externas, y produce embeddings de 384 dimensiones. Es un modelo open-source de alta calidad que ha sido extensamente validado en benchmarks de búsqueda semántica.

Para cada tipo de entidad, el VectorWriter construye el texto que se vectorizará de forma diferente: para las entidades de tipo "party" (clientes/socios), concatena los campos más descriptivos como nombre, empresa, email, ciudad y país; para productos, concatena nombre, descripción, categoría y SKU; para empleados, concatena nombre, título, departamento y habilidades.

Los vectores se almacenan en índices de Pinecone siguiendo la convención de nombres "nexus-{tenant_id}-{entity_type}". El VectorWriter crea el índice automáticamente si no existe. Las operaciones son idempotentes: se usa "upsert" (insertar o actualizar) con el identificador único "{tenant_id}#{source_record_id}", lo que garantiza que procesar el mismo registro múltiples veces no crea duplicados.

### 6.2 El GraphWriter

El GraphWriter almacena los registros en Neo4j como nodos en un grafo de relaciones. Para cada registro, crea un nodo con dos labels: el tipo de entidad capitalizado (Party, Transaction, Product, etc.) y la etiqueta del tenant (Tenant_acme-corp). El nodo se crea usando MERGE, que en Neo4j es la operación idempotente: crea el nodo si no existe, o lo actualiza si ya existe.

Un componente especialmente interesante del GraphWriter es su capacidad de inferir y crear relaciones automáticamente. Cuando un registro contiene campos que terminan en "_id" o "_ref" (como "party_id", "product_ref"), el GraphWriter los interpreta como referencias a otros nodos del grafo y crea relaciones entre ellos si el nodo referenciado existe. Por ejemplo, si un registro de Transaction contiene un campo "party_id" con el valor del identificador de un Party, el GraphWriter crea automáticamente una relación PARTICIPATED_IN entre ese Transaction y ese Party en Neo4j.

### 6.3 El TimeSeriesWriter

El TimeSeriesWriter almacena registros time-series en TimescaleDB, una extensión de PostgreSQL especializada en datos de series temporales. Crea los registros en la hypertable nexus_m3.timeseries, que está particionada automáticamente por TimescaleDB en chunks de un día para mantener el rendimiento de las consultas a medida que el volumen de datos crece.

Para cada registro, extrae el timestamp (del campo extracted_at, timestamp, o created_at), el valor numérico principal (del campo amount, value, count, o total si existe), y una etiqueta descriptiva (del campo description, title, o name). Las inserciones son idempotentes gracias a una cláusula ON CONFLICT que actualiza el registro existente si ya hay un registro con el mismo (tenant_id, source_record_id, extracted_at).

### 6.4 El AIStoreWriteOrchestrator

El Orquestador del Módulo 3 es el coordinador que conecta los tres writers con el pipeline de Kafka. Escucha el topic "m1.int.ai_routing_decided" que contiene las instrucciones de enrutamiento: para cada batch de registros, el mensaje de Kafka especifica el tipo de entidad y el tenant, y el Orquestador determina en qué stores escribir según la tabla de routing.

La tabla de routing es: entidades de tipo "party" van a Pinecone y Neo4j; transacciones van a Neo4j y TimescaleDB; productos van solo a Pinecone; empleados van a Pinecone y Neo4j; incidentes van a Pinecone y TimescaleDB.

---

## 7. Módulo M4 — Governance FastAPI

El Módulo 4 expone las capacidades de gobernanza de NEXUS a través de una API REST construida con FastAPI, el framework de Python más moderno y de mayor rendimiento para construcción de APIs web.

### 7.1 Los modelos de datos (models.py)

Los modelos del Módulo 4 están implementados con Pydantic, la librería de validación y serialización de datos de Python que FastAPI usa de forma nativa. Pydantic garantiza que todos los datos que entran y salen de la API están validados automáticamente contra su schema y que los errores de validación devuelven respuestas de error claras y bien formateadas.

Los modelos principales son: GovernanceProposalCreate/Read para las propuestas de extensión del CDM, MappingReviewCreate/Read para las revisiones de mapeo de campos, y SyncJobRead para el estado de los trabajos de sincronización.

### 7.2 Los routers de la API

La API está organizada en tres routers FastAPI que agrupan los endpoints por dominio funcional:

El router de proposals gestiona el ciclo de vida de las propuestas de extensión del CDM: crear propuestas, listar propuestas (con filtros opcionales por tenant, estado o tipo), aprobar propuestas, y rechazar propuestas. Cuando se aprueba una propuesta, el router publica automáticamente un evento en el topic Kafka "nexus.cdm.extension_proposed" para notificar a los demás módulos del sistema.

El router de mapping_reviews gestiona las revisiones de mapeo de campos. Los analistas pueden aprobar mapeos individuales (cuando están de acuerdo con que el campo del sistema de origen corresponde al campo CDM propuesto por la IA) o rechazarlos (cuando el mapeo no es correcto y necesita ser revisado manualmente).

El router de sync_jobs gestiona los trabajos de sincronización de datos: listar trabajos con sus estados, filtrar por conector o por tenant, y ver los detalles de un trabajo específico incluyendo los conteos de registros procesados y los detalles de cualquier error.

### 7.3 La documentación automática

Una de las ventajas más importantes de FastAPI es que genera automáticamente la documentación OpenAPI (antes llamada Swagger) a partir de los tipos de datos Pydantic. Cualquier desarrollador que quiera integrar su sistema con la API de gobernanza de NEXUS puede acceder a la URL /docs de la API y ver la documentación completa con todos los endpoints, sus parámetros, sus tipos de respuesta, y un cliente interactivo que permite probar los endpoints directamente en el navegador.

---

## 8. El backend NestJS

El backend principal de NEXUS está construido con NestJS, un framework de Node.js para construir aplicaciones del lado del servidor escalables usando TypeScript. NestJS es la elección de arquitectura estándar para backends empresariales en el ecosistema de Node.js debido a su soporte nativo para decoradores, inyección de dependencias, y módulos.

### 8.1 Los módulos de gobernanza

El módulo de gobernanza del backend NestJS incluye tres entidades TypeORM que mapean directamente con las tablas de la base de datos: GovernanceProposal, MappingReview, y SyncJob. TypeORM es el ORM (Object-Relational Mapping) estándar para NestJS y proporciona una capa de abstracción sobre SQL que facilita el desarrollo sin sacrificar la flexibilidad de las consultas complejas cuando se necesitan.

Los 14 endpoints REST del módulo de gobernanza están completamente implementados y probados. Todos requieren autenticación JWT. Los endpoints de modificación de estado (aprobar, rechazar) verifican que el usuario tiene el rol apropiado para realizar la acción.

### 8.2 La autenticación JWT

El sistema de autenticación usa JSON Web Tokens (JWT) como mecanismo de autenticación sin estado. Cuando un usuario se autentica con sus credenciales, el backend genera un JWT firmado con una clave secreta que incluye en su payload el ID del usuario, su tenant_id, su rol, y la fecha de expiración del token. Todos los endpoints protegidos verifican la firma del JWT y extraen la información del usuario del payload.

### 8.3 El script de seed de datos

El archivo seed.ts del backend es un script que inserta datos de demostración en la base de datos: tenants de ejemplo, usuarios administrativos, conectores de ejemplo, propuestas de gobernanza iniciales, y registros de sincronización históricos. Este script es usado para inicializar el entorno de desarrollo y el entorno de demo en pocos segundos.

---

## 9. La interfaz Angular

La interfaz de usuario es una aplicación Angular moderna que proporciona una experiencia de usuario completa para administrar y monitorizar la plataforma NEXUS.

### 9.1 Los componentes del dashboard

La interfaz incluye los siguientes componentes principales:

El Overview es el dashboard principal que muestra un resumen ejecutivo del estado de la plataforma: el número de tenants activos, el número de sincronizaciones en ejecución, el número de propuestas de gobernanza pendientes de revisión, y las métricas de rendimiento del pipeline.

Los componentes de gestión de entidades (Tenants, Users, Products, Customers, Orders & Sales) permiten a los administradores gestionar los datos maestros de la plataforma.

Los componentes de gobernanza (CDM Governance, CDM Versions, Field Mappings, Schema Registry, Pending Approvals) son la consola de control de la gobernanza de datos: permiten revisar y aprobar propuestas, gestionar las versiones del CDM, y configurar los mapeos de campos.

Los componentes operacionales (Source Connectors, Data Health, System Health) muestran el estado de los conectores, la salud del pipeline de datos, y el estado general del sistema.

El componente Audit Log permite a los auditores y administradores de seguridad revisar el historial completo de todos los cambios realizados en la plataforma.

El componente Ask NEXUS es la interfaz de chat con IA que permite a los usuarios hacer preguntas en lenguaje natural sobre los datos de la empresa.

### 9.2 El servicio de datos

El archivo data.service.ts es el servicio Angular que centraliza todas las llamadas a las APIs del backend NestJS y del módulo FastAPI M4. Abstrae completamente los detalles HTTP en métodos semánticos que los componentes de la UI pueden usar: getGovernanceProposals(), approveMapping(), getSystemHealth(), etc.

---

## 10. La estrategia de testing

NEXUS tiene una cobertura de tests automatizados robusta con 140 tests todos pasando, que cubren los componentes críticos de cada módulo.

### 10.1 Tests unitarios de nexus_core

Los tests de nexus_core verifican el comportamiento correcto de todos los tipos de datos, el sistema de topics, y los wrappers de mensajería. Los tests de schemas verifican que las dataclasses se crean correctamente, que los tipos de datos son los esperados, y que los valores por defecto son correctos. Los tests de topics verifican que todos los métodos de CrossModuleTopicNamer producen los nombres de topic correctos en el formato esperado.

### 10.2 Tests de los conectores M1

Los 30 tests del Módulo 1 verifican el comportamiento de ConnectorConfig, RawRecord, la jerarquía de errores, la factory de conectores, el CredentialLoader, y la clase base BaseConnector. Incluyen tests de casos de error como "qué pasa si se intenta crear un conector para un tipo de sistema desconocido" y "qué pasa si las credenciales son incorrectas".

### 10.3 Tests de la API FastAPI M4

Los 27 tests del Módulo 4 verifican todos los endpoints de la API usando el TestClient de FastAPI y HTTPX, que permite hacer peticiones HTTP reales al servidor FastAPI en el mismo proceso de test sin necesidad de un servidor externo. Se verifican los endpoints de health check, los endpoints de proposals (crear, listar, filtrar, aprobar, rechazar), los endpoints de mapping_reviews, y los endpoints de sync_jobs. También se verifica que el schema OpenAPI generado automáticamente contiene todos los endpoints esperados.

### 10.4 Tests del Ciclo Estructural M2

Los 23 tests del Ciclo Estructural verifican el SchemaDriftDetector exhaustivamente: no detecta drift en artefactos idénticos, detecta correctamente los cinco tipos de drift, respeta los umbrales configurables, y produce las severidades correctas para cada tipo de drift. También verifican que el SchemaProfiler y el M2StructuralAgent tienen los valores de configuración correctos (puertos de Prometheus, nombres de consumer groups).

### 10.5 Tests del motor RHMA M2

Los 25 tests del motor RHMA verifican todos los tipos de datos, la estructura del TypedDict de estado, el comportamiento del Guard contra OPA (incluyendo el comportamiento fail-secure cuando OPA no está disponible), las funciones de routing del grafo (should_replan, should_finalize), y los valores de configuración del runner.

---

## 11. Los scripts de infraestructura

NEXUS incluye scripts de infraestructura que automatizan el aprovisionamiento del entorno.

### 11.1 DDL de PostgreSQL

El archivo scripts/ddl_nexus_system.sql contiene el script SQL completo que crea todo el schema de la base de datos: los types de enum, las tablas con todos sus campos y constraints, los índices de rendimiento, las políticas de Row-Level Security, y los datos seed iniciales. Este script es idempotente: puede ejecutarse múltiples veces sin errores gracias al uso de "CREATE TABLE IF NOT EXISTS" y "CREATE INDEX IF NOT EXISTS".

### 11.2 Script de inicialización de Kafka

El archivo scripts/init_kafka_topics.py es un script Python que crea todos los topics de Kafka con su configuración correcta. En el entorno de desarrollo, se ejecuta directamente dentro del contenedor Kafka usando "docker exec" para evitar problemas de conectividad de red entre el host y el contenedor.

---

## 12. El plan de construcción (build plan)

El desarrollo de NEXUS sigue un plan de construcción estructurado documentado en nueve archivos de especificación técnica ubicados en la carpeta build-plan. Estos archivos son la fuente de verdad para el diseño técnico de cada componente de la plataforma.

Los archivos del plan son: NEXUS-02 (M1 Connectors), NEXUS-03 (M1 Workers), NEXUS-04 (M1 Spark CDM Router), NEXUS-05 (M2 Structural SubCycle), NEXUS-06 (M2 RHMA Executive), NEXUS-07 (M3 Writers y M4 Governance completo con Temporal), NEXUS-08 (M6 UI y alertas Prometheus), y NEXUS-09 (E2E tests, contratos inter-equipo, y sign-off final).

Los archivos NEXUS-02 hasta NEXUS-06 están completamente implementados. La implementación siguiente es NEXUS-07.

---

## 13. Próximos pasos — NEXUS-07

NEXUS-07 es el siguiente hito en el plan de construcción. Abarca la finalización de los tres writers del Módulo 3 (VectorWriter, GraphWriter, TimeSeriesWriter), la finalización del AIStoreWriteOrchestrator, la implementación completa del Módulo 4 FastAPI con soporte de Temporal para el workflow de onboarding, y las configuraciones de despliegue en Kubernetes.

El trabajo técnico restante en NEXUS-07 incluye:

Para el Módulo 3, los tres writers ya tienen sus implementaciones base. Lo que resta es: completar el AIStoreWriteOrchestrator con la lógica de enrutamiento completa y su runner de Kafka, agregar las pruebas de integración de los writers, y actualizar el pyproject.toml con las dependencias necesarias (sentence-transformers, pinecone-client, neo4j).

Para el Módulo 4, el router de la API de gobernanza ya tiene los endpoints básicos. Lo que resta es: implementar el endpoint de OnboardingWorkflow que coordina el aprovisionamiento completo de un nuevo tenant (crear schema en base de datos, crear topics Kafka del tenant, configurar el primer conector) usando Temporal para garantizar que cada paso sea ejecutado exactamente una vez incluso si hay fallos intermedios.

Para la infraestructura K8s, se crearán los manifiestos de despliegue para cada componente Python en Kubernetes: Deployments con health checks, Services para exposición de puertos, ConfigMaps para configuración, y HorizontalPodAutoscalers para escalado automático según la carga.

Las pruebas de NEXUS-07 incluirán tests de integración de los tres writers contra instancias locales de las tiendas de datos (usando contenedores Docker de Neo4j, PostgreSQL/TimescaleDB, y un mock de Pinecone).

---

## 14. Próximos pasos — NEXUS-08

NEXUS-08 es el hito de interfaz de usuario avanzada. El trabajo principal consiste en mejorar la interfaz Angular existente o desarrollar una nueva interfaz en Next.js 14, añadiendo las funcionalidades avanzadas que el plan especifica.

Las capacidades adicionales de UI previstas son: la interfaz de chat completa con WebSocket para streaming de respuestas del motor RHMA en tiempo real, la consola de gobernanza con vista completa del historial de versiones del CDM y los mapeos aprobados, los dashboards de Prometheus/Grafana embebidos para observabilidad en tiempo real, y la integración de autenticación con Okta OIDC para el entorno de producción.

Las alertas de Prometheus están diseñadas para cubrir todos los módulos y dispararse cuando: la latencia del pipeline supera el SLA configurado, el lag de un consumer de Kafka supera el umbral de alarma, el ratio de errores de un conector supera el umbral aceptable, o el motor RHMA tiene una tasa de rechazo inusualmente alta que podría indicar problemas con las políticas de OPA o con el Consejo de Críticos.

---

## 15. Próximos pasos — NEXUS-09

NEXUS-09 es el hito final que cierra el proyecto con garantías formales de calidad. Incluye tres suites completas de tests de extremo a extremo (E2E) que verifican el comportamiento del sistema completo de punta a punta, los contratos inter-equipo formalizados, y el checklist de sign-off para la entrega del proyecto.

El test E2E "Happy Path Completo" verifica el recorrido de un dato desde el trigger de sincronización hasta que está disponible para ser consultado por el motor RHMA, incluyendo la verificación de que el correlation_id de trazabilidad es el mismo en todos los logs del pipeline.

El test E2E "Multi-Tenant Isolation" verifica que los datos de un tenant nunca son visibles para otro tenant en ninguna capa del sistema: base de datos (via RLS), Kafka (via tenant_id en los mensajes), Pinecone (via índices separados), Neo4j (via labels de tenant), y TimescaleDB (via RLS también).

El test E2E "Structural Cycle" verifica que el ciclo completo de detección de deriva de esquema funciona correctamente: desde la modificación del esquema de una tabla en el sistema de origen hasta la generación de la propuesta de gobernanza en la consola de administración.

Los cinco contratos inter-equipo que se formalizarán en NEXUS-09 documentan exactamente los formatos de los mensajes de Kafka, los schemas de las tablas compartidas entre módulos, y los SLAs de cada componente. Estos contratos son el mecanismo que garantiza que los distintos equipos de desarrollo (equipo de plataforma, equipo de backend, equipo de frontend) pueden trabajar en paralelo con confianza de que sus componentes se integrarán correctamente cuando se junten.

---

## 16. Estimación de plazos y recursos

El plan de construcción NEXUS fue diseñado para ser ejecutado en un plazo de 14 semanas por un equipo mixto. Los hitos completados representan aproximadamente el 65% del trabajo total planificado.

NEXUS-07 está estimado para tomar aproximadamente 2 semanas de trabajo de un desarrollador backend Python sénior, más una semana de revisión y testing.

NEXUS-08 está estimado para tomar aproximadamente 3 semanas de trabajo de un desarrollador frontend, con soporte parcial del equipo de backend para la integración WebSocket y la autenticación Okta.

NEXUS-09 está estimado para tomar aproximadamente 2 semanas para la implementación completa de los tests E2E, la formalización de los contratos, y el proceso de sign-off.

---

## 17. Riesgos técnicos identificados

El equipo de desarrollo ha identificado los siguientes riesgos técnicos que deben ser monitorizados durante las fases restantes del proyecto.

### Disponibilidad de Pinecone en producción

Pinecone es un servicio de base de datos vectorial gestionado en la nube. La integración local en desarrollo usa la API de Pinecone, que requiere conectividad a Internet y la disponibilidad del servicio. Si por cualquier razón Pinecone no estuviera disponible o se decidiera cambiar de proveedor, el VectorWriter tendría que ser reemplazado por otro gestor de vectores como Qdrant, Weaviate o pgvector. La arquitectura de NEXUS está diseñada para facilitar este cambio: el VectorWriter es una clase concreta con una interfaz bien definida que podría ser reimplementada para otro proveedor sin cambiar el resto del sistema.

### Neo4j en producción

Neo4j AuraDB (la versión gestionada) tiene costos significativos para grandes volúmenes de datos. Se recomienda evaluar si los casos de uso de grafo de relaciones de NEXUS pueden ser satisfechos por herramientas alternativas como Apache Age (extensión de PostgreSQL) o si la inversión en Neo4j está justificada por la complejidad de las consultas de grafo que se necesitarán.

### Costos del LLM en producción

El uso de Claude de Anthropic en el motor RHMA implica un costo por cada token procesado. Para una plataforma con múltiples tenants activos y muchas peticiones diarias, los costos de la API pueden acumularse significativamente. Se recomienda implementar un sistema de caché de respuestas para peticiones repetidas, y evaluar si ciertas tareas de planificación o crítica pueden delegarse a modelos más económicos o a modelos locales (Ollama, llama.cpp) para las peticiones de menor complejidad.

### La latencia del pipeline completo

El SLA informal del pipeline completo (desde el trigger de sincronización hasta los datos disponibles en las tiendas de IA para consulta) es de menos de 10 minutos para un lote de 100 registros. Este SLA debe ser verificado formalmente durante las pruebas E2E de NEXUS-09. Si no se cumple, las áreas más probables de optimización son: la clasificación semántica del Spark job (que puede ser el cuello de botella para grandes volúmenes), y la generación de embeddings batch en el VectorWriter (que puede ser acelerada usando GPU si está disponible).

---

## 18. Conclusión ejecutiva

NEXUS es una plataforma de integración de datos e inteligencia artificial de nivel empresarial, construida con una arquitectura moderna, segura, y escalable. En las fases completadas hasta la fecha, se ha construido la totalidad de la infraestructura central: el bus de mensajería Kafka con 18 topics, la base de datos PostgreSQL con 12 tablas y seguridad por tenant, el almacenamiento de objetos MinIO, el sistema completo de conectores M1, el motor de análisis estructural M2 con detección de deriva de esquemas, el motor ejecutivo de agentes IA RHMA con grafo LangGraph, los tres writers de tiendas de IA M3, la API de gobernanza M4, el backend NestJS con autenticación JWT y 14 endpoints, la interfaz Angular con todos los componentes del dashboard, y 140 tests automatizados con 100% de tasa de éxito.

Lo que diferencia a NEXUS de las plataformas de integración de datos convencionales es precisamente esta combinación de tres capacidades que tradicionalmente han vivido en productos separados: la integración de datos en tiempo real con detección automática de deriva de esquemas, la inteligencia artificial integrada en el pipeline con generación de propuestas de gobernanza, y el motor de consulta en lenguaje natural con sistema multi-agente con evaluación de calidad y autorización. Ninguna plataforma en el mercado combina estas tres capacidades en una arquitectura event-driven cohesiva con garantías de multi-tenancy y gobernanza.

La inversión realizada en la calidad arquitectónica de la plataforma (el sistema de topics centralizado como single source of truth, la idempotencia en todos los writers, el sistema de backpressure, el fail-secure en OPA, los 140 tests) garantiza que la plataforma puede escalar tanto en carga de trabajo como en número de tenants sin necesidad de rewrites significativos.

El equipo técnico tiene el expertise y el plan detallado para completar los hitos restantes (NEXUS-07, NEXUS-08, NEXUS-09) según el calendario del proyecto y entregar la plataforma completa y certificada para producción en el plazo establecido.

---

*Documento preparado para revisión del CTO — Plataforma NEXUS — Marzo 2026*
*Clasificación: Uso interno — Confidencial*

---

## Anexo A — Glosario técnico

**CDM (Common Data Model)**: El modelo de datos unificado al que se mapean todos los datos de todos los sistemas de origen de la plataforma. Define un vocabulario común para las entidades empresariales clave: parties, transactions, products, employees, incidents.

**Drift de esquema**: Cambio en la estructura de una tabla de un sistema de origen. Puede ser la aparición de un campo nuevo, la desaparición de un campo existente, un cambio en el tipo de dato de un campo, un aumento en el porcentaje de valores nulos, o una caída en la unicidad de los valores.

**Embedding vectorial**: Representación numérica del significado semántico de un texto en un espacio matemático de alta dimensión. Permite la búsqueda semántica: encontrar documentos similares en significado aunque no compartan las mismas palabras.

**Event-driven architecture (arquitectura orientada a eventos)**: Patrón de diseño en el que los componentes del sistema se comunican a través de eventos asíncronos en lugar de llamadas directas síncronas. Proporciona desacoplamiento, escalabilidad, y resiliencia.

**Idempotencia**: Propiedad de una operación que puede ejecutarse múltiples veces produciendo siempre el mismo resultado final. En NEXUS, todos los writers de datos son idempotentes: procesar el mismo registro dos veces no crea duplicados.

**KRaft (Kafka Raft Metadata Mode)**: El nuevo modo de operación de Apache Kafka que elimina la dependencia de Apache Zookeeper para la gestión de metadatos del cluster. Simplifica las operaciones y mejora el rendimiento.

**LangGraph**: Framework de orquestación de agentes de inteligencia artificial que permite definir grafos de agentes con estado persistente, ramificación condicional, y ciclos. Desarrollado por LangChain Labs. Usado en NEXUS para el motor RHMA Executive.

**Multi-tenancy**: Arquitectura de software en la que una sola instancia de la aplicación sirve a múltiples clientes (tenants) con garantías de aislamiento total de datos entre ellos.

**OPA (Open Policy Agent)**: Motor de políticas de autorización de código abierto que evalúa peticiones de autorización contra políticas expresadas en el lenguaje Rego. En NEXUS, actúa como el guard-in-guard del motor RHMA.

**RHMA (Reflective Hierarchical Multi-Agent Architecture)**: El nombre del motor ejecutivo de inteligencia artificial de NEXUS. Implementa un sistema de múltiples agentes (Planificador, Workers, Críticos, Guardia) organizados jerárquicamente para responder peticiones en lenguaje natural.

**Row-Level Security (RLS)**: Característica de PostgreSQL que filtra automáticamente las filas visibles para una sesión de base de datos basándose en una política de seguridad configurada. En NEXUS, garantiza que cada proceso solo puede ver los datos del tenant en cuyo contexto está operando.

**Temporal**: Framework de orquestación de workflows duraderos, usado en NEXUS para el OnboardingWorkflow que coordina el aprovisionamiento de nuevos tenants garantizando que cada paso se ejecuta exactamente una vez.

**Topics de Kafka**: Los canales de comunicación de Apache Kafka. En NEXUS, los 18 topics definen la arquitectura completa del flujo de información entre módulos.

---

*Fin del documento*
