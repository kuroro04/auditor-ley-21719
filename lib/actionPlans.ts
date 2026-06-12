// Planes de acción de 3 pasos para cada requisito de la Ley 21.719.
// Paso 1 y Paso 3 son estáticos por requisito.
// Paso 2 se genera dinámicamente en el componente ActionPlan usando los criterios con status 'fail'.

export interface StepDef {
  titulo: string;
  descripcion: string;
}

export interface ActionPlanDef {
  paso1: StepDef;
  paso3: StepDef;
}

export const ACTION_PLANS: Record<string, ActionPlanDef> = {

  politica_privacidad: {
    paso1: {
      titulo: 'Descarga la plantilla de Política de Privacidad',
      descripcion: 'Usa la plantilla preparada para el Art. 14. Incluye todas las secciones obligatorias: identidad del responsable, finalidades, base legal, derechos ARCO y plazos de conservación.',
    },
    paso3: {
      titulo: 'Sube la Política y vuelve a analizar',
      descripcion: 'Una vez completada, sube el documento en formato Word o PDF con texto seleccionable. El sistema verificará automáticamente que cubre todos los criterios del Art. 14.',
    },
  },

  registro_actividades: {
    paso1: {
      titulo: 'Descarga la plantilla de Registro de Actividades',
      descripcion: 'Usa la plantilla del Art. 16. Contiene una tabla estructurada para documentar cada flujo de datos: categorías, finalidades, destinatarios, plazos de supresión y medidas de seguridad.',
    },
    paso3: {
      titulo: 'Sube el Registro y vuelve a analizar',
      descripcion: 'Sube el archivo en Excel o Word. El sistema verificará que incluye todas las secciones del registro exigido por el Art. 16 de la Ley 21.719.',
    },
  },

  procedimiento_arco: {
    paso1: {
      titulo: 'Descarga la plantilla de Procedimiento ARCO',
      descripcion: 'Usa la plantilla del Art. 11–13. Define el canal para recibir solicitudes, los plazos de respuesta (máx. 30 días), la verificación de identidad y los procesos de rectificación y supresión.',
    },
    paso3: {
      titulo: 'Sube el Procedimiento y vuelve a analizar',
      descripcion: 'Sube el documento en Word o PDF. El analizador verificará que cubre los 5 criterios del procedimiento ARCO exigido por la ley.',
    },
  },

  contrato_encargado: {
    paso1: {
      titulo: 'Descarga la plantilla de Contrato con Encargado',
      descripcion: 'Usa la plantilla del Art. 25. Cubre las 7 cláusulas obligatorias: objeto, instrucciones, confidencialidad, seguridad, subcontratación, asistencia ARCO y devolución al término.',
    },
    paso3: {
      titulo: 'Sube el Contrato y vuelve a analizar',
      descripcion: 'Sube el contrato firmado o en borrador en Word o PDF. El sistema verificará que contiene todas las cláusulas exigidas por el Art. 25.',
    },
  },

  evaluacion_impacto: {
    paso1: {
      titulo: 'Descarga la plantilla de Evaluación de Impacto (EIPD)',
      descripcion: 'Usa la plantilla del Art. 38. Incluye secciones para la descripción sistemática del tratamiento, análisis de necesidad y proporcionalidad, identificación de riesgos y medidas de mitigación.',
    },
    paso3: {
      titulo: 'Sube la EIPD y vuelve a analizar',
      descripcion: 'Sube el informe en Word o PDF. El sistema verificará que el documento cubre los 4 elementos obligatorios de la evaluación de impacto.',
    },
  },

  politica_retencion: {
    paso1: {
      titulo: 'Descarga la plantilla de Política de Retención',
      descripcion: 'Usa la plantilla del Art. 7. Incluye la tabla de plazos por categoría de dato, el proceso de revisión periódica, el método de destrucción segura y el responsable designado.',
    },
    paso3: {
      titulo: 'Sube la Política de Retención y vuelve a analizar',
      descripcion: 'Sube el documento en Word o PDF. El analizador verificará que define plazos, procesos de revisión y métodos de destrucción segura exigidos por el Art. 7.',
    },
  },

  registro_rnpa: {
    paso1: {
      titulo: 'Descarga el documento guía de inscripción RNPA',
      descripcion: 'Usa la guía con instrucciones paso a paso para inscribirse en el portal de la APDP y registrar los datos del certificado obtenido.',
    },
    paso3: {
      titulo: 'Sube el comprobante de inscripción y vuelve a analizar',
      descripcion: 'Una vez inscrito en la APDP, sube el certificado o comprobante en PDF. El sistema verificará que incluye el número de inscripción y la fecha de vigencia.',
    },
  },

  plan_brechas: {
    paso1: {
      titulo: 'Descarga la plantilla de Plan de Respuesta ante Brechas',
      descripcion: 'Usa la plantilla del Art. 40. Incluye el protocolo de detección, la notificación a la APDP en 72 horas, el contenido mínimo de la notificación, la comunicación a titulares y el registro histórico.',
    },
    paso3: {
      titulo: 'Sube el Plan y vuelve a analizar',
      descripcion: 'Sube el documento en Word o PDF. El sistema verificará que cubre los 5 criterios del plan de respuesta exigido por el Art. 40 (5.000 UTM de multa máxima).',
    },
  },

  consentimiento: {
    paso1: {
      titulo: 'Descarga la plantilla de Consentimiento Informado',
      descripcion: 'Usa la plantilla del Art. 12. Incluye el texto del consentimiento libre, específico e informado, el mecanismo de obtención, el procedimiento de retiro y el registro de evidencia.',
    },
    paso3: {
      titulo: 'Sube el documento de Consentimiento y vuelve a analizar',
      descripcion: 'Sube el formulario o procedimiento en Word o PDF. El sistema verificará que cumple los 4 criterios del consentimiento informado exigido por el Art. 12.',
    },
  },

  designacion_dpo: {
    paso1: {
      titulo: 'Descarga el Acta de Designación del DPO',
      descripcion: 'Usa la plantilla del Art. 49. Incluye los datos del delegado, sus funciones, garantías de independencia, recursos asignados y la acreditación de notificación a la APDP.',
    },
    paso3: {
      titulo: 'Sube el Acta de Designación y vuelve a analizar',
      descripcion: 'Sube el acta firmada en Word o PDF. El sistema verificará que cubre la identidad del DPO, sus funciones, independencia y la notificación a la APDP exigidas por el Art. 49.',
    },
  },

};
