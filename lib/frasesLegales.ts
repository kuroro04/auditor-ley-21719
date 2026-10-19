// Diccionario de frases legales exactas (multi-palabra) por requisito y criterio.
// Una frase legal exacta vale más que la suma de sus palabras sueltas porque
// indica que el documento usa el lenguaje jurídico correcto de la Ley 21.719.
// Clave externa = ID del requisito. Clave interna = nombre exacto del criterio.

export const FRASES_LEGALES: Record<string, Record<string, string[]>> = {

  politica_privacidad: {
    'Identidad y contacto del responsable de datos': [
      'responsable del tratamiento',
      'encargado del tratamiento',
      'representante legal',
      'datos de contacto del responsable',
    ],
    'Finalidad y propósito del tratamiento': [
      'finalidad del tratamiento',
      'propósito del tratamiento',
      'para qué se utilizan sus datos',
      'uso de los datos personales',
      'fines del tratamiento',
      'finalidades del tratamiento',
      'datos personales serán utilizados para',
      'tratará sus datos personales',
    ],
    'Base legal (consentimiento / interés legítimo)': [
      'consentimiento libre e informado',
      'base legal del tratamiento',
      'interés legítimo del responsable',
      'habilitación legal para el tratamiento',
      'base jurídica del tratamiento',
      'base de licitud',
      'bases de legitimación',
      'consentimiento expreso del titular',
    ],
    'Derechos ARCO del titular (acceso, rectificación...)': [
      'derecho de acceso',
      'derecho de rectificación',
      'derecho de cancelación',
      'derecho de oposición',
      'derechos arco',
      'acceso rectificación cancelación y oposición',
      'derechos del titular de los datos',
      'acceder, rectificar, cancelar u oponerse',
      'revocar su consentimiento',
      'solicitar la eliminación',
    ],
    'Plazo de conservación de los datos': [
      'plazo de conservación',
      'período de retención',
      'tiempo de conservación de los datos',
      'plazo máximo de conservación',
      'período de conservación de los datos',
      'conservará los datos',
      'durante el tiempo necesario',
      'vigencia del tratamiento',
      'serán conservados durante',
    ],
  },

  registro_actividades: {
    'Categorías de datos personales tratados': [
      'categorías de datos personales',
      'tipos de datos personales',
      'datos de carácter personal',
      'categorías de información personal',
    ],
    'Finalidad de cada actividad de tratamiento': [
      'finalidad del tratamiento',
      'propósito de la actividad de tratamiento',
      'finalidad de cada actividad',
    ],
    'Destinatarios y terceros receptores': [
      'destinatarios de los datos',
      'terceros receptores',
      'encargados del tratamiento',
      'transferencia a terceros',
    ],
    'Plazos de supresión o eliminación': [
      'plazo de supresión',
      'plazo de eliminación',
      'período de conservación',
      'plazos de supresión o eliminación',
    ],
    'Medidas de seguridad aplicadas': [
      'medidas de seguridad',
      'medidas técnicas y organizativas',
      'controles de seguridad',
      'medidas de seguridad aplicadas',
    ],
  },

  procedimiento_arco: {
    'Canal formal para recibir solicitudes': [
      'canal formal de solicitudes',
      'mecanismo de solicitud',
      'formulario de solicitud',
      'canal de atención al titular',
    ],
    'Plazo de respuesta (máx. 30 días)': [
      'treinta días hábiles',
      '30 días hábiles',
      'plazo de respuesta de treinta días',
      'plazo máximo de treinta días',
    ],
    'Verificación de identidad del solicitante': [
      'verificación de identidad',
      'acreditación de identidad',
      'comprobación de identidad del solicitante',
      'identificación del titular',
    ],
    'Proceso de rectificación y corrección': [
      'proceso de rectificación',
      'derecho de rectificación',
      'corrección de datos personales',
      'modificación de datos inexactos',
    ],
    'Proceso de supresión / cancelación': [
      'proceso de supresión',
      'derecho de supresión',
      'cancelación de datos personales',
      'derecho al olvido',
      'eliminación de datos personales',
    ],
  },

  contrato_encargado: {
    'Objeto y duración del tratamiento definidos': [
      'objeto del tratamiento',
      'duración del tratamiento',
      'alcance del tratamiento',
      'objeto y duración del contrato',
    ],
    'Instrucciones documentadas del responsable': [
      'instrucciones del responsable',
      'según instrucciones del responsable',
      'instrucciones documentadas',
      'conforme a las instrucciones del responsable',
    ],
    'Obligaciones de confidencialidad': [
      'obligación de confidencialidad',
      'cláusula de confidencialidad',
      'deber de secreto',
      'obligaciones de confidencialidad del encargado',
    ],
    'Cláusula de medidas de seguridad': [
      'medidas de seguridad',
      'medidas técnicas y organizativas',
      'cláusula de seguridad',
      'obligaciones de seguridad del encargado',
    ],
    'Condiciones de subcontratación': [
      'condiciones de subcontratación',
      'subencargado del tratamiento',
      'autorización previa para subcontratar',
      'encargado de tratamiento subcontratado',
    ],
    'Asistencia para solicitudes ARCO': [
      'asistencia para solicitudes arco',
      'cooperación con el responsable',
      'apoyo en el ejercicio de derechos',
      'colaboración en derechos del titular',
    ],
    'Devolución o destrucción al término': [
      'devolución de datos al término',
      'destrucción de datos al término',
      'eliminación al término del contrato',
      'supresión de datos al finalizar',
    ],
  },

  evaluacion_impacto: {
    'Descripción sistemática del tratamiento': [
      'descripción sistemática del tratamiento',
      'descripción detallada del tratamiento',
      'descripción sistemática de las actividades de tratamiento',
    ],
    'Evaluación de necesidad y proporcionalidad': [
      'evaluación de necesidad',
      'principio de proporcionalidad',
      'minimización de datos',
      'necesidad y proporcionalidad del tratamiento',
    ],
    'Identificación de riesgos para titulares': [
      'riesgos para los titulares',
      'identificación de riesgos',
      'análisis de riesgos para los titulares',
      'evaluación de riesgos para los derechos',
    ],
    'Medidas de mitigación de riesgos': [
      'medidas de mitigación',
      'reducción de riesgos',
      'controles de mitigación de riesgos',
      'medidas para mitigar los riesgos',
    ],
  },

  politica_retencion: {
    'Plazos definidos por categoría de dato': [
      'plazo de conservación',
      'período de retención',
      'tiempo máximo de conservación',
      'plazos definidos por categoría',
      'ciclo de vida del dato',
    ],
    'Proceso de revisión periódica': [
      'revisión periódica',
      'auditoría periódica de datos',
      'control periódico de datos',
      'revisión anual de la política',
    ],
    'Método de destrucción segura': [
      'destrucción segura',
      'borrado seguro',
      'eliminación segura e irreversible',
      'eliminación certificada de datos',
      'borrado definitivo e irrecuperable',
    ],
    'Responsable del proceso de eliminación': [
      'responsable de la eliminación',
      'encargado del proceso de baja',
      'cargo responsable de la eliminación',
      'responsable de la destrucción de datos',
    ],
  },

  registro_rnpa: {
    'Certificado o comprobante de inscripción RNPA': [
      'registro nacional de protección de datos',
      'inscripción en el rnpa',
      'número de inscripción rnpa',
      'certificado de inscripción',
      'agencia de protección de datos personales',
    ],
    'Inscripción vigente (no vencida)': [
      'inscripción vigente',
      'registro vigente en el rnpa',
      'inscripción al día',
      'registro actualizado ante la apdp',
    ],
  },

  plan_brechas: {
    'Procedimiento de detección de incidentes': [
      'procedimiento de detección de incidentes',
      'protocolo de detección de brechas',
      'monitoreo continuo de seguridad',
      'sistema de detección de incidentes',
    ],
    'Protocolo de notificación en 72 horas': [
      'notificación en 72 horas',
      'notificación dentro de las 72 horas',
      'plazo de 72 horas para notificar',
      'notificación de brechas de seguridad',
      'notificación a la apdp en 72 horas',
    ],
    'Contenido mínimo de la notificación': [
      'contenido mínimo de la notificación',
      'información sobre la brecha de seguridad',
      'descripción de la brecha de datos',
      'datos afectados en la brecha',
    ],
    'Comunicación a titulares afectados': [
      'comunicación a los titulares afectados',
      'notificación a los titulares afectados',
      'aviso a los afectados por la brecha',
      'información a los titulares afectados',
    ],
    'Registro histórico de incidentes': [
      'registro histórico de incidentes',
      'historial de incidentes de seguridad',
      'log de incidentes',
      'registro de brechas de seguridad',
    ],
  },

  consentimiento: {
    'Consentimiento libre, específico e informado': [
      'consentimiento libre e informado',
      'consentimiento libre específico e informado',
      'consentimiento específico e inequívoco',
      'consentimiento informado del titular',
    ],
    'Información sobre qué datos y para qué': [
      'información sobre el tratamiento',
      'datos recopilados y su finalidad',
      'para qué se utilizarán los datos',
      'descripción de los datos tratados',
    ],
    'Mecanismo de retiro del consentimiento': [
      'retiro del consentimiento',
      'revocación del consentimiento',
      'mecanismo de retiro',
      'revocar el consentimiento en cualquier momento',
    ],
    'Registro de fecha y forma de obtención': [
      'registro del consentimiento',
      'fecha de obtención del consentimiento',
      'evidencia del consentimiento otorgado',
      'constancia de la aceptación',
    ],
  },

  designacion_dpo: {
    'Identidad y datos de contacto del DPO': [
      'delegado de protección de datos',
      'data protection officer',
      'datos de contacto del delegado',
      'delegado de protección de datos personales',
    ],
    'Funciones y responsabilidades definidas': [
      'funciones del delegado',
      'responsabilidades del delegado de protección',
      'atribuciones del dpo',
      'funciones y responsabilidades del delegado',
    ],
    'Independencia y recursos asignados': [
      'independencia del delegado',
      'recursos asignados al delegado',
      'libre de conflictos de interés',
      'independencia funcional del dpo',
    ],
    'Notificación a la APDP realizada': [
      'notificación a la apdp',
      'comunicación a la agencia de protección',
      'inscripción del delegado ante la apdp',
      'notificación de la designación a la apdp',
    ],
  },

};
