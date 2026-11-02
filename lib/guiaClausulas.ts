export interface ClausulaEjemplo {
  titulo: string;
  fundamento: string;
  ejemplo: string;
  consejo: string;
}

export const GUIA_CLAUSULAS: Record<string, Record<string, ClausulaEjemplo>> = {
  politica_privacidad: {
    'Identidad y contacto del responsable de datos': {
      titulo: 'Identificación Formal del Responsable (Art. 14)',
      fundamento: 'Exigido por el Artículo 14 de la Ley N° 21.719.',
      ejemplo: '[Razón Social de la Empresa], RUT [12.345.678-9], con domicilio legal en [Calle, Número, Comuna, Ciudad, Chile], es el responsable del tratamiento de sus datos personales. Para cualquier consulta o ejercicio de derechos, puede contactar a nuestro Encargado de Privacidad al correo privacidad@[empresa].cl o al teléfono [+56 9 1234 5678].',
      consejo: 'Asegúrese de incluir RUT, domicilio formal en Chile y un correo electrónico exclusivo de atención.',
    },
    'Finalidad y propósito del tratamiento': {
      titulo: 'Finalidades Explícitas y Específicas (Art. 14)',
      fundamento: 'Exigido por los Artículos 3 y 14 de la Ley N° 21.719 (Principio de Finalidad).',
      ejemplo: 'Los datos personales recopilados serán tratados con las siguientes finalidades explícitas y legítimas: (a) Prestación y facturación de los servicios contratados; (b) Envío de comunicaciones operativas y estado de cuenta; y (c) Cumplimiento de obligaciones legales y tributarias ante organismos fiscalizadores chilenos.',
      consejo: 'Evite frases genéricas como "para mejorar la experiencia". Enumere cada uso concreto.',
    },
    'Base legal (consentimiento / interés legítimo)': {
      titulo: 'Base de Licitud del Tratamiento (Art. 13 y 14)',
      fundamento: 'Exigido por el Artículo 13 de la Ley N° 21.719.',
      ejemplo: 'La base jurídica que legitima el tratamiento de sus datos corresponde a: (1) La ejecución del contrato de prestación de servicios convenido; (2) El cumplimiento de mandatos legales aplicables; y (3) Su consentimiento libre, previo, informado e inequívoco otorgado al registrarse en nuestra plataforma.',
      consejo: 'Si trata datos sensibles (salud, biometría), el consentimiento debe ser explícito e individualizado.',
    },
    'Derechos ARCO del titular (acceso, rectificación...)': {
      titulo: 'Canales y Ejercicio de Derechos ARCOP (Art. 5 al 10)',
      fundamento: 'Exigido por los Artículos 5, 8, 9 y 10 de la Ley N° 21.719.',
      ejemplo: 'Como titular de datos, usted tiene derecho a solicitar el Acceso, Rectificación, Supresión (Cancelación), Oposición, Portabilidad y Bloqueo de sus antecedentes personales. Dichas solicitudes se recibirán a través del correo privacidad@[empresa].cl y serán tramitadas y respondidas en un plazo máximo de 30 días corridos, sin costo alguno.',
      consejo: 'Mencione expresamente el plazo legal de respuesta (máximo 30 días corridos).',
    },
    'Plazo de conservación de los datos': {
      titulo: 'Plazos de Retención y Criterios de Baja (Art. 7 y 14 N° 5)',
      fundamento: 'Exigido por el Artículo 14 N° 5 de la Ley N° 21.719.',
      ejemplo: 'Los datos personales serán conservados únicamente durante la vigencia de la relación contractual. Una vez finalizada, se mantendrán bloqueados por un plazo máximo de 5 años para responder ante posibles responsabilidades tributarias o legales, procediéndose posteriormente a su eliminación definitiva y segura.',
      consejo: 'Especifique un número de años o un evento objetivo de término (ej: 5 años tributarios, fin de contrato).',
    },
  },

  registro_actividades: {
    'Categorías de datos personales tratados': {
      titulo: 'Categorización de Datos Tratados (Art. 16 N° 1)',
      fundamento: 'Exigido por el Artículo 16 de la Ley N° 21.719.',
      ejemplo: 'Se tratan las siguientes categorías de datos: Identificatorios (Nombre, RUT), De Contacto (Correo, Teléfono, Dirección), Laborales (Cargo, Historial de Desempeño) y Económicos/Bancarios (Datos de cuenta para transferencias).',
      consejo: 'Distinga explícitamente si recopila datos sensibles (origen étnico, salud, biometría).',
    },
    'Finalidad de cada actividad de tratamiento': {
      titulo: 'Finalidad Concreta por Actividad de Tratamiento (Art. 16 N° 2)',
      fundamento: 'Exigido por el Artículo 16 N° 2 de la Ley N° 21.719.',
      ejemplo: 'Cada operación registrada persigue un propósito exclusivo: (a) En RRHH, el procesamiento de liquidaciones de sueldo y cotizaciones previsionales; (b) En Ventas, la formalización de contratos de servicios y despacho; (c) En Soporte, la resolución de incidentes técnicos.',
      consejo: 'No agrupe todas las áreas bajo una misma descripción. Detalle cada flujo operativo.',
    },
    'Destinatarios y terceros receptores': {
      titulo: 'Destinatarios y Transferencias (Art. 16 N° 3)',
      fundamento: 'Exigido por el Artículo 16 de la Ley N° 21.719.',
      ejemplo: 'Los datos no se ceden a terceros salvo autorización legal expresa. Actúan como encargados tecnológicos: AWS (Servidores en EE.UU., bajo cláusulas contractuales tipo) y Proveedor de Facturación Electrónica local.',
      consejo: 'Indique si existen transferencias internacionales o servicios cloud extranjeros.',
    },
    'Plazos de supresión o eliminación': {
      titulo: 'Plazo de Supresión por Actividad (Art. 16 N° 4)',
      fundamento: 'Exigido por el Artículo 16 de la Ley N° 21.719.',
      ejemplo: 'Para la actividad de Gestión de Clientes, el plazo de eliminación es de 3 años tras la última compra. Para Gestión de Recursos Humanos, 5 años desde el finiquito laboral conforme al Código del Trabajo.',
      consejo: 'El RAT exige un plazo o criterio de eliminación específico para cada fila o actividad.',
    },
    'Medidas de seguridad aplicadas': {
      titulo: 'Medidas Técnicas y Organizativas (Art. 16 N° 5 y Art. 19)',
      fundamento: 'Exigido por los Artículos 16 y 19 de la Ley N° 21.719.',
      ejemplo: 'Se aplican las siguientes salvaguardas: Cifrado en tránsito (TLS 1.3), cifrado en reposo (AES-256), autenticación multifactor (MFA/TOTP) obligatoria para el personal y bitácora inmutable de accesos con SHA-256.',
      consejo: 'Detalle medidas tanto técnicas (cifrado, firewalls) como organizativas (capacitaciones, acuerdos de confidencialidad).',
    },
  },

  procedimiento_arco: {
    'Canal formal para recibir solicitudes': {
      titulo: 'Canal Formal y Accesible de Derechos ARCOP (Art. 11 al 13)',
      fundamento: 'Exigido por los Artículos 11, 12 y 13 de la Ley N° 21.719.',
      ejemplo: 'La empresa dispone de un canal electrónico exclusivo y gratuito para la recepción de solicitudes ARCOP a través del correo derechos.privacidad@[empresa].cl y mediante el formulario web disponible en [https://empresa.cl/derechos-arco]. Toda recepción generará un comprobante formal con número de seguimiento correlativo y fecha cierta.',
      consejo: 'El canal debe ser gratuito, de fácil acceso y otorgar acuse de recibo inmediato con código de caso.',
    },
    'Plazo de respuesta (máx. 30 días)': {
      titulo: 'Cómputo y Cumplimiento del Plazo Legal de 30 Días (Art. 12)',
      fundamento: 'Exigido por el Artículo 12 de la Ley N° 21.719.',
      ejemplo: 'El Responsable dará respuesta formal a toda solicitud en un plazo máximo e improrrogable de treinta (30) días corridos contados desde la acreditación fehaciente de la identidad del solicitante. En caso excepcional de prórroga por complejidad técnica justificada, se informará al titular antes del vencimiento del plazo original.',
      consejo: 'La ley chilena 21.719 fija un tope legal de 30 días corridos; sobrepasarlo constituye infracción sancionable por la APDP.',
    },
    'Verificación de identidad del solicitante': {
      titulo: 'Mecanismo Seguro de Validación de Identidad (Art. 11)',
      fundamento: 'Exigido por el Artículo 11 de la Ley N° 21.719.',
      ejemplo: 'Para prevenir suplantaciones y resguardar la confidencialidad, el titular deberá adjuntar copia simple de su cédula de identidad por ambos lados o validar su identidad mediante ClaveÚnica o certificado digital. En caso de actuar mediante apoderado, se exigirá poder notarial con facultades expresas de representación.',
      consejo: 'Exija verificación proporcional sin imponer trabas desmedidas que dificulten el ejercicio legítimo del derecho.',
    },
    'Proceso de rectificación y corrección': {
      titulo: 'Protocolo de Rectificación y Actualización de Datos (Art. 6)',
      fundamento: 'Exigido por el Artículo 6 de la Ley N° 21.719.',
      ejemplo: 'Cuando el titular acredite que sus datos son erróneos, inexactos, equívocos o incompletos, el Responsable procederá a su corrección o complementación en todas las bases de datos activas en un plazo máximo de 10 días hábiles desde su calificación favorable, notificando además a los terceros encargados que los procesen.',
      consejo: 'Indique qué antecedentes o documentos de respaldo debe aportar el titular para sustentar la rectificación.',
    },
    'Proceso de supresión / cancelación': {
      titulo: 'Protocolo de Cancelación, Supresión y Bloqueo (Art. 7)',
      fundamento: 'Exigido por los Artículos 7 y 10 de la Ley N° 21.719.',
      ejemplo: 'El titular podrá solicitar la supresión de sus datos cuando su almacenamiento carezca de fundamento legal, hayan caducado sus finalidades o se revoque el consentimiento. Acogida la solicitud, se procederá al borrado seguro e irreversible de los registros o a su bloqueo temporal si subsisten deberes legales o tributarios de conservación.',
      consejo: 'Aclare el tratamiento de respaldo y el régimen de bloqueo obligatorio previo a la destrucción definitiva.',
    },
  },

  contrato_encargado: {
    'Objeto y duración del tratamiento definidos': {
      titulo: 'Objeto y Duración del Tratamiento por Encargo (Art. 25 N° 1)',
      fundamento: 'Exigido por el Artículo 25 N° 1 de la Ley N° 21.719.',
      ejemplo: 'El presente instrumento tiene por objeto regular el tratamiento de datos personales efectuado por el Encargado por cuenta y encargo exclusivo del Responsable. La vigencia del tratamiento se extenderá únicamente mientras se mantenga vigente el contrato de prestación de servicios principal convenido entre las partes.',
      consejo: 'Debe constar por escrito o formato digital auditable, delimitando con precisión el servicio contratado.',
    },
    'Instrucciones documentadas del responsable': {
      titulo: 'Instrucciones Escritas y Documentadas (Art. 25 N° 1)',
      fundamento: 'Exigido por el Artículo 25 N° 1 de la Ley N° 21.719.',
      ejemplo: 'El Encargado tratará los datos personales siguiendo estrictamente las instrucciones documentadas emanadas por el Responsable, quedando expresamente prohibido destinar o utilizar los antecedentes para finalidades propias, cederlos o transferirlos a cualquier tercero sin previa autorización formal.',
      consejo: 'Establezca una cláusula que obligue al proveedor a avisar si una instrucción vulnera la Ley 21.719.',
    },
    'Obligaciones de confidencialidad': {
      titulo: 'Deber de Secreto y Confidencialidad Permanente (Art. 25 N° 2)',
      fundamento: 'Exigido por el Artículo 25 N° 2 de la Ley N° 21.719.',
      ejemplo: 'El Encargado garantiza que toda persona bajo su dependencia autorizada para procesar datos personales ha suscrito un compromiso formal de confidencialidad y reserva profesional. Dicha obligación permanecerá vigente con posterioridad al cese de la relación laboral o comercial.',
      consejo: 'Establezca expresamente que el deber de confidencialidad no prescribe con la terminación del contrato.',
    },
    'Cláusula de medidas de seguridad': {
      titulo: 'Medidas Técnicas y Organizativas de Seguridad (Art. 25 N° 3)',
      fundamento: 'Exigido por los Artículos 19 y 25 N° 3 de la Ley N° 21.719.',
      ejemplo: 'El Encargado implementará y mantendrá operativas medidas técnicas y organizativas adecuadas al nivel de riesgo del tratamiento, incluyendo cifrado en tránsito y reposo, control de acceso autenticado, segregación de entornos y auditorías periódicas de vulnerabilidad.',
      consejo: 'Reserve la facultad de auditar periódicamente los sistemas e instalaciones del encargado o exigir certificaciones (ISO 27001 / SOC 2).',
    },
    'Condiciones de subcontratación': {
      titulo: 'Autorización Previa para Subcontratación (Art. 25 N° 4)',
      fundamento: 'Exigido por el Artículo 25 N° 4 de la Ley N° 21.719.',
      ejemplo: 'El Encargado no podrá subcontratar la ejecución total o parcial de los servicios que involucren tratamiento de datos sin autorización previa, expresa y por escrito del Responsable. Cualquier subcontratista autorizado asumirá contractualmente las mismas exigencias y obligaciones de protección establecidas en este acto.',
      consejo: 'La subcontratación no autorizada expone a la empresa a sanciones graves bajo la nueva legislación.',
    },
    'Asistencia para solicitudes ARCO': {
      titulo: 'Asistencia Operativa ante Derechos ARCOP (Art. 25 N° 5)',
      fundamento: 'Exigido por el Artículo 25 N° 5 de la Ley N° 21.719.',
      ejemplo: 'El Encargado se compromete a prestar asistencia activa al Responsable, mediante herramientas técnicas y operativas idóneas, para responder las solicitudes de titulares relativas a derechos de acceso, rectificación, supresión u oposición en un plazo interno no superior a 5 días hábiles desde su requerimiento.',
      consejo: 'Defina un plazo interno breve (ej: 5 días hábiles) para que el proveedor le entregue la información necesaria para responder al titular.',
    },
    'Devolución o destrucción al término': {
      titulo: 'Destino Final de los Datos al Término del Contrato (Art. 25 N° 7)',
      fundamento: 'Exigido por el Artículo 25 N° 7 de la Ley N° 21.719.',
      ejemplo: 'Concluida la prestación de servicios, el Encargado deberá, a elección del Responsable, devolver íntegramente o destruir de forma segura y certificada todos los datos personales y copias existentes en sus servidores, emitiendo una constancia escrita de supresión definitiva dentro de los 15 días posteriores al término.',
      consejo: 'Exija siempre un certificado de destrucción segura de respaldos y medios magnéticos.',
    },
  },

  evaluacion_impacto: {
    'Descripción sistemática del tratamiento': {
      titulo: 'Descripción Integral y Mapeo del Flujo de Datos (Art. 21)',
      fundamento: 'Exigido por el Artículo 21 de la Ley N° 21.719.',
      ejemplo: 'La presente EIPD describe detalladamente el ciclo de vida de los datos personales tratados: fuentes de recolección, sistemas involucrados, categorías de titulares afectados, tecnologías analíticas o de perfilamiento aplicadas y transferencias previstas hacia terceros o plataformas en la nube.',
      consejo: 'Incluya diagramas de flujo de datos y especifique si se emplean sistemas de toma de decisiones automatizadas.',
    },
    'Evaluación de necesidad y proporcionalidad': {
      titulo: 'Juicio de Necesidad, Proporcionalidad e Idoneidad (Art. 21)',
      fundamento: 'Exigido por los Artículos 3 y 21 de la Ley N° 21.719.',
      ejemplo: 'Se evalúa que el tratamiento resulta estrictamente indispensable para la finalidad declarada, no existiendo mecanismos alternativos menos invasivos que permitan alcanzar idéntico objetivo, respetando en todo momento el principio de minimización de datos.',
      consejo: 'Justifique por qué no es posible lograr el mismo resultado utilizando datos anonimizados o seudonimizados.',
    },
    'Identificación de riesgos para titulares': {
      titulo: 'Matriz de Riesgos sobre Derechos y Libertades (Art. 21)',
      fundamento: 'Exigido por el Artículo 21 de la Ley N° 21.719.',
      ejemplo: 'Se identifican y valoran las siguientes amenazas potenciales: acceso no autorizado a información confidencial, filtración de datos sensibles, suplantación de identidad o discriminación arbitraria derivada de perfilamiento automático, evaluando su probabilidad e impacto.',
      consejo: 'Utilice una matriz cuantitativa o cualitativa de probabilidad x severidad para ponderar cada riesgo.',
    },
    'Medidas de mitigación de riesgos': {
      titulo: 'Plan de Mitigación y Salvaguardas Compensatorias (Art. 21)',
      fundamento: 'Exigido por los Artículos 19 y 21 de la Ley N° 21.719.',
      ejemplo: 'Para mitigar los riesgos identificados a un nivel residual aceptable, se implementa: cifrado de extremo a extremo, enmascaramiento dinámico de identificadores, doble factor de autenticación obligatorio y revisiones de seguridad periódicas cada 6 meses.',
      consejo: 'Defina responsables concretos y plazos de ejecución para cada medida de control implementada.',
    },
  },

  politica_retencion: {
    'Plazos definidos por categoría de dato': {
      titulo: 'Cronograma de Retención por Categoría de Datos (Art. 7)',
      fundamento: 'Exigido por el Artículo 7 de la Ley N° 21.719.',
      ejemplo: 'Los plazos de conservación se establecen según la naturaleza del dato: (a) Datos contractuales y de facturación: 5 años contados desde el término del servicio; (b) Datos de prospectos comerciales: 12 meses desde el último contacto; (c) Antecedentes laborales: 5 años tras la extinción del vínculo.',
      consejo: 'Evite fórmulas indefinidas como "se guardarán el tiempo que sea necesario". Indique plazos específicos.',
    },
    'Proceso de revisión periódica': {
      titulo: 'Ciclo de Auditoría y Depuración Periódica (Art. 7 y 19)',
      fundamento: 'Exigido por los Artículos 7 y 19 de la Ley N° 21.719.',
      ejemplo: 'La empresa ejecutará un proceso de revisión y depuración semestral de todas sus bases de datos, con el propósito de identificar registros inactivos cuyo plazo de retención haya expirado y proceder a su marcado para bloqueo o eliminación.',
      consejo: 'Agende revisiones con periodicidad fija (semestral o anual) y deje constancia escrita en el registro de auditoría.',
    },
    'Método de destrucción segura': {
      titulo: 'Protocolo de Borrado Seguro y Destrucción Física (Art. 19)',
      fundamento: 'Exigido por el Artículo 19 de la Ley N° 21.719.',
      ejemplo: 'La eliminación digital se ejecutará aplicando algoritmos de sobreescritura de datos conforme a la norma DoD 5220.22-M o desmagnetización. La documentación en papel se destruirá mediante trituración mecánica de corte cruzado (Nivel DIN P-4).',
      consejo: 'Especifique el estándar técnico de borrado para evitar recuperaciones no autorizadas.',
    },
    'Responsable del proceso de eliminación': {
      titulo: 'Designación de Responsable Operativo de Bajas (Art. 19)',
      fundamento: 'Exigido por el Artículo 19 de la Ley N° 21.719.',
      ejemplo: 'El Oficial de Seguridad de la Información (CISO) o el Encargado de TI será el custodio responsable de autorizar, coordinar y certificar cada ciclo de destrucción de antecedentes, emitiendo el acta de supresión correspondiente.',
      consejo: 'Indique cargo o departamento responsable de firmar las actas de eliminación de registros.',
    },
  },

  registro_rnpa: {
    'Certificado o comprobante de inscripción RNPA': {
      titulo: 'Inscripción Formal en el Registro Nacional de la APDP (Art. 28)',
      fundamento: 'Exigido por el Artículo 28 de la Ley N° 21.719.',
      ejemplo: 'La entidad declara haber completado la solicitud de registro ante el Registro Nacional de Protección de Datos Personales administrado por la Agencia de Protección de Datos Personales (APDP), bajo el Folio N° [REG-2026-XXXXX].',
      consejo: 'Conserve el certificado digital o comprobante de folio emitido por la autoridad fiscalizadora.',
    },
    'Inscripción vigente (no vencida)': {
      titulo: 'Vigencia y Actualización Periódica del Registro (Art. 28)',
      fundamento: 'Exigido por el Artículo 28 de la Ley N° 21.719.',
      ejemplo: 'La inscripción en el RNPA se mantendrá vigente y actualizada anualmente o dentro de los 30 días posteriores a cualquier cambio relevante en las actividades de tratamiento, categorías de datos o datos del responsable.',
      consejo: 'La ley exige actualizar el registro ante cualquier modificación estructural en el tratamiento.',
    },
  },

  plan_brechas: {
    'Procedimiento de detección de incidentes': {
      titulo: 'Detección, Registro y Clasificación de Incidentes (Art. 20)',
      fundamento: 'Exigido por el Artículo 20 de la Ley N° 21.719.',
      ejemplo: 'Se establece un mecanismo de monitoreo y alerta temprana que documentará en una bitácora inmutable todo evento de seguridad que comprometa la confidencialidad, integridad o disponibilidad de datos personales dentro de los 60 minutos de detectado.',
      consejo: 'Defina niveles de severidad (Bajo, Medio, Alto, Crítico) para priorizar la respuesta operativa.',
    },
    'Protocolo de notificación en 72 horas': {
      titulo: 'Notificación Obligatoria a la APDP en 72 Horas (Art. 20)',
      fundamento: 'Exigido por el Artículo 20 de la Ley N° 21.719.',
      ejemplo: 'En caso de vulneración a la seguridad que represente un riesgo para los derechos de los titulares, el Responsable notificará formalmente a la Agencia de Protección de Datos Personales a más tardar dentro de las setenta y dos (72) horas siguientes a su toma de conocimiento.',
      consejo: 'El plazo de 72 horas es perentorio; documente con exactitud la hora de detección inicial.',
    },
    'Contenido mínimo de la notificación': {
      titulo: 'Contenido Legal del Informe de Brecha (Art. 20)',
      fundamento: 'Exigido por el Artículo 20 de la Ley N° 21.719.',
      ejemplo: 'La comunicación a la autoridad incluirá como mínimo: (1) Naturaleza de la brecha y categorías de datos afectados; (2) Número aproximado de personas involucradas; (3) Consecuencias probables; y (4) Medidas correctivas inmediatas y de contención adoptadas.',
      consejo: 'Si no dispone de todos los detalles a las 72 horas, puede remitir un reporte preliminar y complementarlo por fases.',
    },
    'Comunicación a titulares afectados': {
      titulo: 'Aviso Transparente a Titulares de Datos (Art. 20)',
      fundamento: 'Exigido por el Artículo 20 de la Ley N° 21.719.',
      ejemplo: 'Cuando la vulneración entrañe un alto riesgo de perjuicio patrimonial, fraude o daño moral para los titulares, se les comunicará directamente en lenguaje claro y comprensible, informando las recomendaciones de mitigación (ej: cambio de contraseñas).',
      consejo: 'Redacte el aviso en lenguaje accesible, evitando tecnicismos informáticos complejos.',
    },
    'Registro histórico de incidentes': {
      titulo: 'Bitácora Inmutable y Trazable de Vulneraciones (Art. 20)',
      fundamento: 'Exigido por el Artículo 20 de la Ley N° 21.719.',
      ejemplo: 'La organización mantendrá un registro histórico de todas las brechas de seguridad ocurridas, detallando los hechos, sus efectos, el análisis de causa raíz y las medidas de remediación implementadas a disposición de la APDP.',
      consejo: 'Conserve las evidencias técnicas y logs forenses por un período mínimo de 3 años.',
    },
  },

  consentimiento: {
    'Consentimiento libre, específico e informado': {
      titulo: 'Otorgamiento de Consentimiento Válido (Art. 13)',
      fundamento: 'Exigido por el Artículo 13 de la Ley N° 21.719.',
      ejemplo: 'He leído y acepto libre, específica e inequívocamente la Política de Privacidad de [Empresa], consintiendo el tratamiento de mis datos personales para las finalidades informadas. Se prohíbe el uso de casillas premarcadas o aceptación tácita.',
      consejo: 'El consentimiento jamás puede presumirse ni obtenerse mediante casillas premarcadas (opt-out). Exija siempre opt-in explícito.',
    },
    'Información sobre qué datos y para qué': {
      titulo: 'Información Previa y Detallada al Titular (Art. 13 y 14)',
      fundamento: 'Exigido por los Artículos 13 y 14 de la Ley N° 21.719.',
      ejemplo: 'Previo al otorgamiento de su autorización, se informa al usuario de manera clara y comprensible: qué datos exactos se solicitarán, para qué fines concretos se emplearán y con quiénes se compartirán eventualmente.',
      consejo: 'Use una capa de información resumida y un enlace directo a la política completa.',
    },
    'Mecanismo de retiro del consentimiento': {
      titulo: 'Revocabilidad Sencilla y Gratuita (Art. 13)',
      fundamento: 'Exigido por el Artículo 13 de la Ley N° 21.719.',
      ejemplo: 'El titular podrá revocar su consentimiento en cualquier momento mediante un procedimiento expedito y gratuito a través de un clic en el enlace de desuscripción de cada correo o enviando un mensaje a privacidad@[empresa].cl.',
      consejo: 'Revocar el consentimiento debe ser tan fácil como fue otorgarlo.',
    },
    'Registro de fecha y forma de obtención': {
      titulo: 'Evidencia Probatoria y Trazabilidad del Otorgamiento (Art. 13)',
      fundamento: 'Exigido por el Artículo 13 de la Ley N° 21.719.',
      ejemplo: 'El sistema almacenará una constancia auditable de cada consentimiento otorgado, registrando fecha, hora UTC, dirección IP, versión exacta del texto aceptado y credencial del usuario.',
      consejo: 'La carga de la prueba recae siempre en la empresa (Responsable del tratamiento).',
    },
  },

  designacion_dpo: {
    'Identidad y datos de contacto del DPO': {
      titulo: 'Identificación y Canal de Contacto del DPO (Art. 26)',
      fundamento: 'Exigido por el Artículo 26 de la Ley N° 21.719.',
      ejemplo: 'Se designa como Delegado de Protección de Datos (DPO) a [Nombre Completo / Entidad Especializada], RUT [XX.XXX.XXX-X], cuyos datos de contacto directos son: correo dpo@[empresa].cl y domicilio postal en [Dirección].',
      consejo: 'Los datos de contacto deben ser de acceso público para titulares y para la APDP.',
    },
    'Funciones y responsabilidades definidas': {
      titulo: 'Facultades y Cometidos del Oficial de Privacidad (Art. 26)',
      fundamento: 'Exigido por el Artículo 26 de la Ley N° 21.719.',
      ejemplo: 'El DPO ejercerá las funciones de: supervisar el cumplimiento de la Ley 21.719, asesorar en evaluaciones de impacto (EIPD), capacitar al personal y actuar como enlace con la Agencia de Protección de Datos Personales.',
      consejo: 'Detalle sus atribuciones en la descripción formal del puesto de trabajo o contrato de servicios.',
    },
    'Independencia y recursos asignados': {
      titulo: 'Autonomía Operativa y Dotación de Recursos (Art. 26)',
      fundamento: 'Exigido por el Artículo 26 de la Ley N° 21.719.',
      ejemplo: 'El DPO desempeñará sus funciones con plena independencia técnica, reportando directamente al Directorio o alta gerencia, garantizándosele el presupuesto y recursos tecnológicos necesarios para sus cometidos.',
      consejo: 'El DPO no puede recibir instrucciones sobre cómo resolver o emitir sus dictámenes legales.',
    },
    'Notificación a la APDP realizada': {
      titulo: 'Comunicación Formal del Nombramiento a la Autoridad (Art. 26)',
      fundamento: 'Exigido por el Artículo 26 de la Ley N° 21.719.',
      ejemplo: 'La designación del DPO ha sido informada a la Agencia de Protección de Datos Personales conforme a los formularios oficiales, adjuntando la acreditación de idoneidad y datos de contacto correspondientes.',
      consejo: 'Guarde el comprobante de presentación digital ante la autoridad reguladora.',
    },
  },
};

export function obtenerGuiaClausula(reqId: string, criterioName: string): ClausulaEjemplo {
  const reqGuia = GUIA_CLAUSULAS[reqId];

  // 1. Coincidencia directa
  if (reqGuia && reqGuia[criterioName]) {
    return reqGuia[criterioName];
  }

  // 2. Coincidencia flexible / normalizada dentro del mismo requisito
  if (reqGuia) {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const critNorm = norm(criterioName);
    for (const [key, val] of Object.entries(reqGuia)) {
      const keyNorm = norm(key);
      if (critNorm.includes(keyNorm) || keyNorm.includes(critNorm)) {
        return val;
      }
    }
    // Si hay alguna guía en este reqId, devolver la primera como referencia adaptable
    const firstKey = Object.keys(reqGuia)[0];
    if (firstKey) {
      return reqGuia[firstKey];
    }
  }

  // 3. Fallback inteligente universal para cualquier requisito de la Ley 21.719
  return {
    titulo: `Cláusula de Cumplimiento: ${criterioName}`,
    fundamento: 'Exigido por las disposiciones y estándares de la Ley N° 21.719 sobre Protección de Datos Personales.',
    ejemplo: `La organización [Nombre de la Empresa] establece que respecto a "${criterioName}", se aplicarán protocolos formales y verificables para garantizar el debido cumplimiento de las obligaciones legales aplicables, disponiendo de registros auditables, plazos acotados y medidas de resguardo proporcionales al riesgo del tratamiento.`,
    consejo: 'Incorpore esta cláusula de forma expresa en el documento correspondiente para subsanar la observación identificada por el auditor.',
  };
}
