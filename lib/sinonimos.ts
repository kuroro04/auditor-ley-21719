// Diccionario de sinónimos por requisito y criterio.
// Clave externa = ID del requisito en REQUISITOS.
// Clave interna = nombre exacto del criterio (debe coincidir con criterio.name).
// Edite aquí para ampliar la detección sin tocar el motor ni los requisitos.

export const SINONIMOS: Record<string, Record<string, string[]>> = {

  politica_privacidad: {
    'Identidad y contacto del responsable de datos': [
      'controlador', 'data controller', 'encargado del tratamiento',
      'representante legal', 'titular del tratamiento', 'responsable del tratamiento',
      'razón social', 'domiciliada',
    ],
    'Finalidad y propósito del tratamiento': [
      'motivo del tratamiento', 'uso de datos', 'razón del tratamiento',
      'para qué se usan los datos', 'objetivo del tratamiento',
    ],
    'Base legal (consentimiento / interés legítimo)': [
      'habilitación legal', 'fundamento jurídico', 'licitud',
      'título legal', 'base jurídica', 'legitimación',
      'base de licitud', 'bases de legitimación',
    ],
    'Derechos ARCO del titular (acceso, rectificación...)': [
      'derechos del titular', 'portabilidad', 'supresión',
      'derecho al olvido', 'derecho de supresión',
      'acceder', 'rectificar', 'oponerse',
    ],
    'Plazo de conservación de los datos': [
      'período de guarda', 'ciclo de vida', 'tiempo de almacenamiento',
      'período de retención', 'duración del tratamiento',
      'conservará', 'vigencia',
    ],
  },

  registro_actividades: {
    'Categorías de datos personales tratados': [
      'clases de datos', 'naturaleza de los datos', 'tipo de información',
      'datos de carácter personal', 'categorías de información',
    ],
    'Finalidad de cada actividad de tratamiento': [
      'motivo', 'objetivo del tratamiento', 'razón', 'propósito de uso',
    ],
    'Destinatarios y terceros receptores': [
      'cesionarios', 'subencargados', 'data processors',
      'partners', 'socios', 'receptores de datos',
    ],
    'Plazos de supresión o eliminación': [
      'borrado', 'destrucción', 'período de retención', 'tiempo de baja',
    ],
    'Medidas de seguridad aplicadas': [
      'protección', 'salvaguardas', 'controles técnicos',
      'ISO 27001', 'controles organizativos',
    ],
  },

  procedimiento_arco: {
    'Canal formal para recibir solicitudes': [
      'medio de contacto', 'buzón', 'mecanismo de solicitud', 'plataforma de atención',
    ],
    'Plazo de respuesta (máx. 30 días)': [
      'mes', 'término legal', 'lapso de respuesta', 'plazo hábil',
    ],
    'Verificación de identidad del solicitante': [
      'identificación', 'acreditación', 'comprobación', 'validación de identidad',
    ],
    'Proceso de rectificación y corrección': [
      'enmienda', 'actualización de datos', 'cambio de información', 'modificación del registro',
    ],
    'Proceso de supresión / cancelación': [
      'remoción', 'derecho al olvido', 'borrado definitivo', 'eliminación permanente',
    ],
  },

  contrato_encargado: {
    'Objeto y duración del tratamiento definidos': [
      'propósito del contrato', 'vigencia', 'período contractual', 'alcance del tratamiento',
    ],
    'Instrucciones documentadas del responsable': [
      'directivas', 'mandato', 'órdenes del responsable', 'indicaciones contractuales',
    ],
    'Obligaciones de confidencialidad': [
      'reserva', 'privacidad', 'cláusula de no divulgación', 'NDA', 'secreto profesional',
    ],
    'Cláusula de medidas de seguridad': [
      'controles técnicos', 'salvaguardas', 'seguridad de la información', 'medidas organizativas',
    ],
    'Condiciones de subcontratación': [
      'sub-procesador', 'proveedor externo', 'cadena de suministro', 'subencargado de datos',
    ],
    'Asistencia para solicitudes ARCO': [
      'apoyo', 'colaboración', 'asistencia al responsable', 'cooperación con el responsable',
    ],
    'Devolución o destrucción al término': [
      'restitución', 'eliminación al cierre', 'borrado final', 'disposición al término',
    ],
  },

  evaluacion_impacto: {
    'Descripción sistemática del tratamiento': [
      'análisis detallado', 'mapeo de datos', 'descripción del proceso de datos', 'inventario de tratamiento',
    ],
    'Evaluación de necesidad y proporcionalidad': [
      'pertinencia', 'adecuación', 'limitación del tratamiento', 'mínimo necesario',
    ],
    'Identificación de riesgos para titulares': [
      'amenazas', 'vulnerabilidades', 'análisis de riesgo', 'exposición a riesgos',
    ],
    'Medidas de mitigación de riesgos': [
      'reducción de riesgos', 'controles compensatorios', 'tratamiento del riesgo', 'plan de acción',
    ],
  },

  politica_retencion: {
    'Plazos definidos por categoría de dato': [
      'vigencia del dato', 'duración del almacenamiento', 'ciclo de vida del dato', 'período de conservación',
    ],
    'Proceso de revisión periódica': [
      'control periódico', 'evaluación regular', 'revisión programada', 'auditoría de datos',
    ],
    'Método de destrucción segura': [
      'trituración', 'supresión segura', 'sanitización', 'borrado certificado', 'eliminación irrecuperable',
    ],
    'Responsable del proceso de eliminación': [
      'delegado', 'persona designada', 'cargo responsable', 'encargado de la baja',
    ],
  },

  registro_rnpa: {
    'Certificado o comprobante de inscripción RNPA': [
      'certificado apdp', 'registro oficial', 'inscripción formal', 'número de registro', 'folio',
    ],
    'Inscripción vigente (no vencida)': [
      'activo', 'en vigor', 'no vencido', 'actualizado', 'al día',
    ],
  },

  plan_brechas: {
    'Procedimiento de detección de incidentes': [
      'vigilancia', 'supervisión', 'aviso', 'evento de seguridad', 'monitoreo continuo',
    ],
    'Protocolo de notificación en 72 horas': [
      'tres días', 'período de notificación', 'plazo legal de notificación', 'notificación inmediata',
    ],
    'Contenido mínimo de la notificación': [
      'información de la brecha', 'detalle del incidente', 'contenido obligatorio', 'elementos de la notificación',
    ],
    'Comunicación a titulares afectados': [
      'afectados', 'personas impactadas', 'aviso a los titulares', 'información a los interesados',
    ],
    'Registro histórico de incidentes': [
      'registro de eventos', 'trazabilidad', 'base de datos de incidentes', 'historial de seguridad',
    ],
  },

  consentimiento: {
    'Consentimiento libre, específico e informado': [
      'voluntario', 'expreso', 'explícito', 'sin ambigüedad', 'consentimiento válido',
    ],
    'Información sobre qué datos y para qué': [
      'información sobre el tratamiento', 'descripción de datos recopilados', 'detalle de finalidad',
    ],
    'Mecanismo de retiro del consentimiento': [
      'revocar autorización', 'desuscribir', 'rechazar el tratamiento', 'cancelar autorización',
    ],
    'Registro de fecha y forma de obtención': [
      'evidencia del consentimiento', 'prueba de aceptación', 'log de consentimiento', 'auditoría del consentimiento',
    ],
  },

  designacion_dpo: {
    'Identidad y datos de contacto del DPO': [
      'data protection officer', 'encargado de privacidad',
      'delegado de protección de datos', 'oficial de privacidad',
    ],
    'Funciones y responsabilidades definidas': [
      'rol del delegado', 'competencias del DPO', 'atribuciones', 'obligaciones del DPO',
    ],
    'Independencia y recursos asignados': [
      'autonomía', 'libre de conflictos de interés', 'imparcialidad', 'posición independiente',
    ],
    'Notificación a la APDP realizada': [
      'informado a la autoridad', 'declarado ante la APDP', 'reportado al regulador', 'comunicado a la agencia',
    ],
  },

};
