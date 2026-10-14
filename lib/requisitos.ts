import type { Requisito } from './types';
import { SINONIMOS } from './sinonimos';
import { FRASES_LEGALES } from './frasesLegales';

// ═══════════════════════════════════════════════════════════════════════════
// VERSIÓN DEL CHECKLIST — debe actualizarse cada vez que se agreguen, quiten
// o modifiquen requisitos/criterios en este archivo, para que el historial
// de análisis quede trazado a la versión exacta del checklist que se usó.
// ═══════════════════════════════════════════════════════════════════════════
export const CHECKLIST_VERSION = 'Checklist Ley 21.719 v1.0';
export const CHECKLIST_VERSION_DATE = '2026-07-24';
export const CHECKLIST_VERSION_LABEL = `${CHECKLIST_VERSION} — ${CHECKLIST_VERSION_DATE}`;

// Obtiene los sinónimos de un criterio desde el diccionario centralizado
const s = (reqId: string, criterioName: string): string[] =>
  SINONIMOS[reqId]?.[criterioName] ?? [];

// Obtiene las frases legales exactas de un criterio desde el diccionario
const fl = (reqId: string, criterioName: string): string[] =>
  FRASES_LEGALES[reqId]?.[criterioName] ?? [];

export const REQUISITOS: Requisito[] = [
  {
    id: 'politica_privacidad',
    num: '01',
    nombre: 'Política de privacidad',
    art: 'Art. 14 — Deber de información',
    desc: 'Documento que informa a sus clientes qué datos recopila, para qué y quién es el responsable.',
    multa: '500 UTM',
    nivel: 'medio',
    plazo: { date: 'Vigente', urgency: 'ok' },
    legalDetail: {
      articulo: 'Artículo 14 — Deber de información',
      documentoEvidencia: 'Política de privacidad publicada y accesible al titular antes o al momento de la recopilación',
      exigenciaSimple: 'La ley obliga a informar al titular, antes o al momento de recopilar sus datos, quién es el responsable, para qué se usarán, cuál es la base legal, qué derechos tiene y cuánto tiempo se conservarán. Debe estar redactada en lenguaje claro y estar disponible en el sitio web o punto de contacto.',
    },
    criterios: [
      {
        name: 'Identidad y contacto del responsable de datos',
        keywords: ['responsable','rut','domicilio','contacto','encargado'],
        synonyms: s('politica_privacidad', 'Identidad y contacto del responsable de datos'),
        frasesLegales: fl('politica_privacidad', 'Identidad y contacto del responsable de datos'),
        validado: true,
      },
      {
        name: 'Finalidad y propósito del tratamiento',
        keywords: ['finalidad','propósito','para qué','objetivo'],
        synonyms: s('politica_privacidad', 'Finalidad y propósito del tratamiento'),
        frasesLegales: fl('politica_privacidad', 'Finalidad y propósito del tratamiento'),
        validado: true,
      },
      {
        name: 'Base legal (consentimiento / interés legítimo)',
        keywords: ['consentimiento','base legal','interés legítimo','autorización'],
        synonyms: s('politica_privacidad', 'Base legal (consentimiento / interés legítimo)'),
        frasesLegales: fl('politica_privacidad', 'Base legal (consentimiento / interés legítimo)'),
        validado: true,
      },
      {
        name: 'Derechos ARCO del titular (acceso, rectificación...)',
        keywords: ['acceso','rectificación','cancelación','oposición','derechos','arco'],
        synonyms: s('politica_privacidad', 'Derechos ARCO del titular (acceso, rectificación...)'),
        frasesLegales: fl('politica_privacidad', 'Derechos ARCO del titular (acceso, rectificación...)'),
        validado: true,
      },
      {
        name: 'Plazo de conservación de los datos',
        keywords: ['conservación','retención','plazo','tiempo','eliminar'],
        synonyms: s('politica_privacidad', 'Plazo de conservación de los datos'),
        frasesLegales: fl('politica_privacidad', 'Plazo de conservación de los datos'),
        validado: true,
      },
    ],
    clasificacion: {
      marcadoresPerformativos: [
        'tratamos sus datos', 'tratamos tus datos', 'sus datos personales son tratados',
        'usted tiene derecho a', 'usted puede ejercer', 'puede solicitar acceso',
        'nuestros datos de contacto', 'la empresa responsable es', 'somos responsables de',
        'recopilamos los siguientes datos', 'utilizamos sus datos para',
        'conservamos sus datos', 'le informamos que', 'datos del responsable',
        'el usuario podrá', 'el titular podrá', 'el usuario tendrá', 'el titular tendrá',
        'representante legal corresponde', 'conservará los datos', 'consiente expresamente',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'el art.', 'el artículo', 'según el artículo',
          'el responsable debe', 'debe informar', 'la normativa requiere',
          'la empresa está obligada', 'este artículo establece', 'conforme a la ley',
        ],
        tier2: [
          'plan maestro', 'cronograma', 'etapa', 'hito',
          'análisis de cumplimiento', 'gestión de proyecto', 'equipo de proyecto',
          'diagnóstico de cumplimiento', 'brecha de cumplimiento',
        ],
      },
    },
  },
  {
    id: 'registro_actividades',
    num: '02',
    nombre: 'Registro de actividades de tratamiento',
    art: 'Art. 16 — Registro interno obligatorio',
    desc: 'Inventario interno que documenta todos los flujos de datos personales que su empresa maneja.',
    multa: '1.000 UTM',
    nivel: 'alto',
    plazo: { date: 'Vigente', urgency: 'ok' },
    legalDetail: {
      articulo: 'Artículo 16 — Registro de actividades de tratamiento',
      documentoEvidencia: 'Registro interno (planilla, base de datos o documento) de todos los flujos de datos personales',
      exigenciaSimple: 'El responsable debe mantener un inventario actualizado de cada actividad en que trata datos personales, indicando categorías de datos, finalidades, destinatarios, plazos de supresión y medidas de seguridad. Este registro es de uso interno pero debe estar disponible para la APDP si lo solicita.',
    },
    criterios: [
      {
        name: 'Categorías de datos personales tratados',
        keywords: ['categorías','tipos de datos','datos sensibles','personales'],
        synonyms: s('registro_actividades', 'Categorías de datos personales tratados'),
        frasesLegales: fl('registro_actividades', 'Categorías de datos personales tratados'),
        validado: true,
      },
      {
        name: 'Finalidad de cada actividad de tratamiento',
        keywords: ['finalidad','propósito'],
        synonyms: s('registro_actividades', 'Finalidad de cada actividad de tratamiento'),
        frasesLegales: fl('registro_actividades', 'Finalidad de cada actividad de tratamiento'),
        validado: true,
      },
      {
        name: 'Destinatarios y terceros receptores',
        keywords: ['destinatarios','encargados','terceros','proveedores','receptores'],
        synonyms: s('registro_actividades', 'Destinatarios y terceros receptores'),
        frasesLegales: fl('registro_actividades', 'Destinatarios y terceros receptores'),
        validado: true,
      },
      {
        name: 'Plazos de supresión o eliminación',
        keywords: ['supresión','eliminación','plazo','baja'],
        synonyms: s('registro_actividades', 'Plazos de supresión o eliminación'),
        frasesLegales: fl('registro_actividades', 'Plazos de supresión o eliminación'),
        validado: true,
      },
      {
        name: 'Medidas de seguridad aplicadas',
        keywords: ['seguridad','cifrado','medidas','controles'],
        synonyms: s('registro_actividades', 'Medidas de seguridad aplicadas'),
        frasesLegales: fl('registro_actividades', 'Medidas de seguridad aplicadas'),
        validado: true,
      },
    ],
    clasificacion: {
      marcadoresPerformativos: [
        'este registro contiene', 'hemos registrado las siguientes actividades',
        'el responsable registra', 'nuestras actividades de tratamiento',
        'los datos que tratamos son', 'las categorías de datos que tratamos',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'según el artículo', 'el responsable debe',
          'la normativa requiere', 'conforme al artículo', 'el registro debe incluir',
        ],
        tier2: [
          'plantilla de rat', 'tabla de actividades', 'inventario de tratamiento',
          'este template', 'guía de cumplimiento',
        ],
      },
    },
  },
  {
    id: 'procedimiento_arco',
    num: '03',
    nombre: 'Procedimiento de derechos ARCO',
    art: 'Art. 11–13 — Derechos del titular',
    desc: 'Protocolo escrito para atender solicitudes de acceso, rectificación, cancelación y oposición en máximo 30 días.',
    multa: '1.000 UTM',
    nivel: 'alto',
    plazo: { date: 'Vigente', urgency: 'ok' },
    legalDetail: {
      articulo: 'Artículos 11–13 — Derechos de acceso, rectificación, cancelación y oposición',
      documentoEvidencia: 'Procedimiento escrito y canal formal habilitado para recibir solicitudes de titulares',
      exigenciaSimple: 'Toda empresa debe tener un proceso documentado para que los titulares puedan ejercer sus derechos en un máximo de 30 días hábiles. El procedimiento debe indicar cómo verificar la identidad del solicitante, cómo tramitar cada tipo de solicitud y cómo comunicar la resolución.',
    },
    criterios: [
      {
        name: 'Canal formal para recibir solicitudes',
        keywords: ['canal','formulario','correo','solicitudes','recepción'],
        synonyms: s('procedimiento_arco', 'Canal formal para recibir solicitudes'),
        frasesLegales: fl('procedimiento_arco', 'Canal formal para recibir solicitudes'),
        validado: true,
      },
      {
        name: 'Plazo de respuesta (máx. 30 días)',
        keywords: ['30 días','treinta','plazo','respuesta'],
        synonyms: s('procedimiento_arco', 'Plazo de respuesta (máx. 30 días)'),
        frasesLegales: fl('procedimiento_arco', 'Plazo de respuesta (máx. 30 días)'),
        validado: true,
      },
      {
        name: 'Verificación de identidad del solicitante',
        keywords: ['identidad','verificación','autenticación','rut'],
        synonyms: s('procedimiento_arco', 'Verificación de identidad del solicitante'),
        frasesLegales: fl('procedimiento_arco', 'Verificación de identidad del solicitante'),
        validado: true,
      },
      {
        name: 'Proceso de rectificación y corrección',
        keywords: ['rectificación','corrección','modificación'],
        synonyms: s('procedimiento_arco', 'Proceso de rectificación y corrección'),
        frasesLegales: fl('procedimiento_arco', 'Proceso de rectificación y corrección'),
        validado: true,
      },
      {
        name: 'Proceso de supresión / cancelación',
        keywords: ['supresión','cancelación','eliminar','borrar','baja'],
        synonyms: s('procedimiento_arco', 'Proceso de supresión / cancelación'),
        frasesLegales: fl('procedimiento_arco', 'Proceso de supresión / cancelación'),
        validado: true,
      },
    ],
    clasificacion: {
      marcadoresPerformativos: [
        'puede ejercer sus derechos enviando', 'para ejercer sus derechos contacte',
        'procesaremos su solicitud en', 'responderemos su solicitud en un plazo',
        'enviando su solicitud a', 'podrá ejercer sus derechos a través',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley establece que', 'según el artículo', 'el responsable debe responder',
          'la normativa obliga', 'el plazo legal es', 'conforme a la ley',
        ],
        tier2: [
          'procedimiento interno', 'este procedimiento', 'guía de derechos',
          'paso a paso', 'manual de atención',
        ],
      },
    },
  },
  {
    id: 'contrato_encargado',
    num: '04',
    nombre: 'Contrato con encargado de datos',
    art: 'Art. 25 — Encargado de tratamiento',
    desc: 'Si usa proveedores externos que procesan datos de sus clientes (cloud, marketing, RRHH), necesita un contrato especial.',
    multa: '2.000 UTM',
    nivel: 'alto',
    plazo: { date: 'Vigente', urgency: 'pronto' },
    legalDetail: {
      articulo: 'Artículo 25 — Encargado de tratamiento',
      documentoEvidencia: 'Contrato o cláusula adicional firmado con cada proveedor que trata datos en nombre del responsable',
      exigenciaSimple: 'Si usa servicios de terceros (cloud, marketing, nómina, CRM) que procesan datos de sus clientes, la ley exige un contrato que detalle qué pueden hacer con esos datos, cómo deben protegerlos, qué pasa al terminar el contrato y cómo deben colaborar ante solicitudes ARCO.',
    },
    criterios: [
      {
        name: 'Objeto y duración del tratamiento definidos',
        keywords: ['objeto','duración','alcance','término'],
        synonyms: s('contrato_encargado', 'Objeto y duración del tratamiento definidos'),
        frasesLegales: fl('contrato_encargado', 'Objeto y duración del tratamiento definidos'),
        validado: true,
      },
      {
        name: 'Instrucciones documentadas del responsable',
        keywords: ['instrucciones','instrucción','según instrucciones'],
        synonyms: s('contrato_encargado', 'Instrucciones documentadas del responsable'),
        frasesLegales: fl('contrato_encargado', 'Instrucciones documentadas del responsable'),
        validado: true,
      },
      {
        name: 'Obligaciones de confidencialidad',
        keywords: ['confidencialidad','secreto','no divulgar','sigilo'],
        synonyms: s('contrato_encargado', 'Obligaciones de confidencialidad'),
        frasesLegales: fl('contrato_encargado', 'Obligaciones de confidencialidad'),
        validado: true,
      },
      {
        name: 'Cláusula de medidas de seguridad',
        keywords: ['medidas seguridad','seguridad informática','protección'],
        synonyms: s('contrato_encargado', 'Cláusula de medidas de seguridad'),
        frasesLegales: fl('contrato_encargado', 'Cláusula de medidas de seguridad'),
        validado: true,
      },
      {
        name: 'Condiciones de subcontratación',
        keywords: ['subencargado','subcontratación','terceros'],
        synonyms: s('contrato_encargado', 'Condiciones de subcontratación'),
        frasesLegales: fl('contrato_encargado', 'Condiciones de subcontratación'),
        validado: true,
      },
      {
        name: 'Asistencia para solicitudes ARCO',
        keywords: ['asistencia','arco','solicitudes titular','cooperación'],
        synonyms: s('contrato_encargado', 'Asistencia para solicitudes ARCO'),
        frasesLegales: fl('contrato_encargado', 'Asistencia para solicitudes ARCO'),
        validado: true,
      },
      {
        name: 'Devolución o destrucción al término',
        keywords: ['devolución','destrucción','término','cese','fin contrato'],
        synonyms: s('contrato_encargado', 'Devolución o destrucción al término'),
        frasesLegales: fl('contrato_encargado', 'Devolución o destrucción al término'),
        validado: true,
      },
    ],
    clasificacion: {
      marcadoresPerformativos: [
        'el encargado se obliga a', 'en virtud del presente contrato',
        'el presente contrato regula', 'el encargado tratará únicamente',
        'las partes acuerdan que', 'el encargado garantiza',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'según el artículo', 'el responsable debe',
          'la normativa requiere', 'el contrato debe incluir',
        ],
        tier2: [
          'este contrato tipo', 'modelo de contrato', 'plantilla contractual',
          'cláusula tipo',
        ],
      },
    },
  },
  {
    id: 'evaluacion_impacto',
    num: '05',
    nombre: 'Evaluación de impacto (EIPD)',
    art: 'Art. 38 — Evaluación de impacto en privacidad',
    desc: 'Análisis formal de riesgos. Obligatorio si trata datos sensibles o a gran escala.',
    multa: '3.000 UTM',
    nivel: 'alto',
    plazo: { date: '31 Ago', urgency: 'pronto' },
    legalDetail: {
      articulo: 'Artículo 38 — Evaluación de impacto en protección de datos (EIPD)',
      documentoEvidencia: 'Informe formal de evaluación de impacto con descripción sistemática, análisis de riesgos y medidas de mitigación',
      exigenciaSimple: 'Cuando el tratamiento involucra datos sensibles, vigilancia a gran escala o tecnologías de alto riesgo (IA, biometría, perfilamiento), la ley exige un análisis formal previo al tratamiento que identifique riesgos para las personas y defina medidas para reducirlos.',
    },
    criterios: [
      {
        name: 'Descripción sistemática del tratamiento',
        keywords: ['descripción sistemática','descripción del tratamiento'],
        synonyms: s('evaluacion_impacto', 'Descripción sistemática del tratamiento'),
        frasesLegales: fl('evaluacion_impacto', 'Descripción sistemática del tratamiento'),
        validado: false,
      },
      {
        name: 'Evaluación de necesidad y proporcionalidad',
        keywords: ['necesidad','proporcionalidad','minimización'],
        synonyms: s('evaluacion_impacto', 'Evaluación de necesidad y proporcionalidad'),
        frasesLegales: fl('evaluacion_impacto', 'Evaluación de necesidad y proporcionalidad'),
        validado: false,
      },
      {
        name: 'Identificación de riesgos para titulares',
        keywords: ['riesgos','evaluación de riesgos','probabilidad','impacto'],
        synonyms: s('evaluacion_impacto', 'Identificación de riesgos para titulares'),
        frasesLegales: fl('evaluacion_impacto', 'Identificación de riesgos para titulares'),
        validado: false,
      },
      {
        name: 'Medidas de mitigación de riesgos',
        keywords: ['mitigación','medidas','salvaguardas','controles'],
        synonyms: s('evaluacion_impacto', 'Medidas de mitigación de riesgos'),
        frasesLegales: fl('evaluacion_impacto', 'Medidas de mitigación de riesgos'),
        validado: false,
      },
    ],
    clasificacion: {
      marcadoresPerformativos: [
        'esta evaluación analiza', 'el presente estudio de impacto',
        'hemos identificado los siguientes riesgos', 'los riesgos analizados son',
        'la presente dpia concluye', 'el responsable ha evaluado',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'según el artículo', 'el responsable debe realizar',
          'la normativa requiere', 'cuando el tratamiento requiere', 'conforme al artículo',
        ],
        tier2: [
          'guía de evaluación', 'metodología de evaluación', 'paso a paso',
          'plantilla dpia', 'este análisis de cumplimiento',
        ],
      },
    },
  },
  {
    id: 'politica_retencion',
    num: '06',
    nombre: 'Política de retención y eliminación',
    art: 'Art. 7 — Limitación del plazo de conservación',
    desc: 'Documento que define cuánto tiempo guarda cada tipo de dato y cómo los destruye de forma segura.',
    multa: '1.000 UTM',
    nivel: 'medio',
    plazo: { date: 'Vigente', urgency: 'ok' },
    legalDetail: {
      articulo: 'Artículo 7 — Principio de limitación del plazo de conservación',
      documentoEvidencia: 'Política interna de retención y eliminación de datos personales con plazos definidos por categoría',
      exigenciaSimple: 'Los datos personales solo pueden conservarse durante el tiempo necesario para el fin que justificó su recopilación. La empresa debe definir plazos máximos para cada tipo de dato y destruirlos de forma segura e irreversible una vez vencidos.',
    },
    criterios: [
      {
        name: 'Plazos definidos por categoría de dato',
        keywords: ['plazo','período','tiempo máximo','años','meses'],
        synonyms: s('politica_retencion', 'Plazos definidos por categoría de dato'),
        frasesLegales: fl('politica_retencion', 'Plazos definidos por categoría de dato'),
        validado: false,
      },
      {
        name: 'Proceso de revisión periódica',
        keywords: ['revisión periódica','auditoría','anual','verificación'],
        synonyms: s('politica_retencion', 'Proceso de revisión periódica'),
        frasesLegales: fl('politica_retencion', 'Proceso de revisión periódica'),
        validado: false,
      },
      {
        name: 'Método de destrucción segura',
        keywords: ['destrucción','borrado seguro','anonimización','shredding','eliminación'],
        synonyms: s('politica_retencion', 'Método de destrucción segura'),
        frasesLegales: fl('politica_retencion', 'Método de destrucción segura'),
        validado: false,
      },
      {
        name: 'Responsable del proceso de eliminación',
        keywords: ['responsable','encargado','dpo','cargo'],
        synonyms: s('politica_retencion', 'Responsable del proceso de eliminación'),
        frasesLegales: fl('politica_retencion', 'Responsable del proceso de eliminación'),
        validado: false,
      },
    ],
    clasificacion: {
      marcadoresPerformativos: [
        'los datos se conservarán durante', 'eliminaremos los datos tras',
        'esta política establece los plazos', 'destruiremos los datos cuando',
        'el plazo de conservación que aplicamos', 'conservamos los datos durante',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'según el artículo', 'el responsable debe',
          'la normativa establece', 'los datos deben eliminarse', 'conforme a la ley',
        ],
        tier2: [
          'política de retención', 'ciclo de vida del dato',
          'programa de gestión de datos', 'guía de retención', 'calendario de destrucción',
        ],
      },
    },
  },
  {
    id: 'registro_rnpa',
    num: '07',
    nombre: 'Inscripción en el RNPA',
    art: 'Art. 55 — Registro Nacional de Protección de Datos',
    desc: 'Su empresa debe registrarse formalmente ante la APDP como responsable de tratamiento de datos.',
    multa: '1.000 UTM',
    nivel: 'alto',
    plazo: { date: '09 Jun', urgency: 'urgent' },
    legalDetail: {
      articulo: 'Artículo 55 — Registro Nacional de Protección de Datos (RNPA)',
      documentoEvidencia: 'Certificado o número de inscripción vigente en el RNPA emitido por la APDP',
      exigenciaSimple: 'Toda empresa que trate datos personales debe inscribirse formalmente ante la Agencia de Protección de Datos (APDP) en el Registro Nacional de Protección de Datos. Sin inscripción la empresa opera ilegalmente y queda expuesta a multas desde el primer día.',
    },
    criterios: [
      {
        name: 'Certificado o comprobante de inscripción RNPA',
        keywords: ['rnpa','registro nacional','inscripción','número inscripción','apdp'],
        synonyms: s('registro_rnpa', 'Certificado o comprobante de inscripción RNPA'),
        frasesLegales: fl('registro_rnpa', 'Certificado o comprobante de inscripción RNPA'),
        validado: false,
      },
      {
        name: 'Inscripción vigente (no vencida)',
        keywords: ['vigente','inscripción vigente','fecha inscripción'],
        synonyms: s('registro_rnpa', 'Inscripción vigente (no vencida)'),
        frasesLegales: fl('registro_rnpa', 'Inscripción vigente (no vencida)'),
        validado: false,
      },
    ],
    clasificacion: {
      marcadoresPerformativos: [
        'inscrito en el rnpa con número', 'nuestra empresa está inscrita',
        'el número de inscripción es', 'inscripción vigente número',
        'nos encontramos registrados', 'registrado ante la apdp',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'según el artículo', 'el responsable debe inscribirse',
          'la normativa obliga', 'conforme al artículo', 'la obligación legal de inscripción',
        ],
        tier2: [
          'trámite de inscripción', 'formulario de registro',
          'guía de inscripción', 'requisitos para registrarse', 'cómo inscribirse',
        ],
      },
    },
  },
  {
    id: 'plan_brechas',
    num: '08',
    nombre: 'Plan de respuesta ante brechas',
    art: 'Art. 40 — Notificación de brechas de seguridad',
    desc: 'Protocolo que detalla cómo actuará su empresa si ocurre una fuga de datos. Tiene 72 horas para notificar a la APDP.',
    multa: '5.000 UTM',
    nivel: 'critico',
    plazo: { date: 'Vigente', urgency: 'urgent' },
    legalDetail: {
      articulo: 'Artículo 40 — Notificación de brechas de seguridad de datos personales',
      documentoEvidencia: 'Plan de respuesta ante incidentes de seguridad y brechas de datos, con protocolo de notificación',
      exigenciaSimple: 'Si ocurre una fuga, acceso no autorizado o pérdida de datos personales, la empresa tiene 72 horas para notificar a la APDP. Debe comunicar a los titulares afectados si existe riesgo para sus derechos. El plan debe existir antes del incidente, no después.',
    },
    criterios: [
      {
        name: 'Procedimiento de detección de incidentes',
        keywords: ['detección','monitoreo','alerta','incidente'],
        synonyms: s('plan_brechas', 'Procedimiento de detección de incidentes'),
        frasesLegales: fl('plan_brechas', 'Procedimiento de detección de incidentes'),
        validado: false,
      },
      {
        name: 'Protocolo de notificación en 72 horas',
        keywords: ['72 horas','setenta y dos','notificación apdp','notificar'],
        synonyms: s('plan_brechas', 'Protocolo de notificación en 72 horas'),
        frasesLegales: fl('plan_brechas', 'Protocolo de notificación en 72 horas'),
        validado: false,
      },
      {
        name: 'Contenido mínimo de la notificación',
        keywords: ['contenido','descripción brecha','datos afectados','notificación'],
        synonyms: s('plan_brechas', 'Contenido mínimo de la notificación'),
        frasesLegales: fl('plan_brechas', 'Contenido mínimo de la notificación'),
        validado: false,
      },
      {
        name: 'Comunicación a titulares afectados',
        keywords: ['titulares afectados','comunicar personas','notificar usuarios'],
        synonyms: s('plan_brechas', 'Comunicación a titulares afectados'),
        frasesLegales: fl('plan_brechas', 'Comunicación a titulares afectados'),
        validado: false,
      },
      {
        name: 'Registro histórico de incidentes',
        keywords: ['registro','log','historial','incidentes','bitácora'],
        synonyms: s('plan_brechas', 'Registro histórico de incidentes'),
        frasesLegales: fl('plan_brechas', 'Registro histórico de incidentes'),
        validado: false,
      },
    ],
    clasificacion: {
      marcadoresPerformativos: [
        'ante una brecha procederemos a', 'notificaremos a la apdp en un plazo',
        'comunicaremos a los afectados', 'el protocolo establece que notificaremos',
        'en caso de incidente de seguridad', 'nuestro plan de respuesta ante brechas',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'según el artículo', 'el responsable debe notificar',
          'la normativa obliga a notificar', 'el plazo legal de notificación',
          'conforme al artículo',
        ],
        tier2: [
          'plan de respuesta a incidentes', 'guía de respuesta',
          'este plan de acción', 'protocolo de gestión',
        ],
      },
    },
  },
  {
    id: 'consentimiento',
    num: '09',
    nombre: 'Consentimiento informado documentado',
    art: 'Art. 12 — Requisitos del consentimiento',
    desc: 'Evidencia de que sus clientes o usuarios autorizaron voluntariamente el tratamiento de sus datos.',
    multa: '2.000 UTM',
    nivel: 'alto',
    plazo: { date: 'Vigente', urgency: 'pronto' },
    legalDetail: {
      articulo: 'Artículo 12 — Requisitos del consentimiento',
      documentoEvidencia: 'Formulario, checkbox, contrato u otro mecanismo documentado de obtención del consentimiento con registro de fecha',
      exigenciaSimple: 'Cuando la base legal del tratamiento es el consentimiento, este debe ser libre, específico, informado e inequívoco. La empresa debe poder demostrar cuándo y cómo lo obtuvo, y el titular puede retirarlo en cualquier momento sin consecuencias negativas.',
    },
    criterios: [
      {
        name: 'Consentimiento libre, específico e informado',
        keywords: ['libre','específico','informado','inequívoco'],
        synonyms: s('consentimiento', 'Consentimiento libre, específico e informado'),
        frasesLegales: fl('consentimiento', 'Consentimiento libre, específico e informado'),
        validado: false,
      },
      {
        name: 'Información sobre qué datos y para qué',
        keywords: ['qué datos','para qué','finalidad','datos tratados'],
        synonyms: s('consentimiento', 'Información sobre qué datos y para qué'),
        frasesLegales: fl('consentimiento', 'Información sobre qué datos y para qué'),
        validado: false,
      },
      {
        name: 'Mecanismo de retiro del consentimiento',
        keywords: ['retirar','revocar','retirar consentimiento','baja','opt-out'],
        synonyms: s('consentimiento', 'Mecanismo de retiro del consentimiento'),
        frasesLegales: fl('consentimiento', 'Mecanismo de retiro del consentimiento'),
        validado: false,
      },
      {
        name: 'Registro de fecha y forma de obtención',
        keywords: ['fecha consentimiento','registro','cuando','cómo obtuvo'],
        synonyms: s('consentimiento', 'Registro de fecha y forma de obtención'),
        frasesLegales: fl('consentimiento', 'Registro de fecha y forma de obtención'),
        validado: false,
      },
    ],
    clasificacion: {
      marcadoresPerformativos: [
        'usted consiente expresamente', 'al aceptar esta política',
        'hemos obtenido su consentimiento', 'puede retirar su consentimiento enviando',
        'el titular ha otorgado su consentimiento', 'el consentimiento se obtiene mediante',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'según el artículo', 'el consentimiento debe ser',
          'la normativa requiere', 'el consentimiento válido debe', 'conforme al artículo',
        ],
        tier2: [
          'formulario de consentimiento', 'gestión del consentimiento',
          'registro de consentimientos', 'base de datos de consentimientos',
        ],
      },
    },
  },
  {
    id: 'designacion_dpo',
    num: '10',
    nombre: 'Designación del Delegado DPO',
    art: 'Art. 49 — Delegado de protección de datos',
    desc: 'Si su empresa trata datos a gran escala o datos sensibles, debe designar formalmente un Delegado de Protección de Datos.',
    multa: '2.000 UTM',
    nivel: 'medio',
    plazo: { date: '30 Jun', urgency: 'pronto' },
    legalDetail: {
      articulo: 'Artículo 49 — Delegado de Protección de Datos (DPO)',
      documentoEvidencia: 'Acta de designación formal del DPO y notificación enviada a la APDP',
      exigenciaSimple: 'Las empresas que traten datos sensibles o a gran escala deben designar un Delegado de Protección de Datos con independencia funcional, reportar su designación a la APDP y dotarle de los recursos necesarios. El DPO actúa como punto de contacto con la autoridad y los titulares.',
    },
    criterios: [
      {
        name: 'Identidad y datos de contacto del DPO',
        keywords: ['dpo','delegado','nombre delegado','contacto dpo','correo dpo'],
        synonyms: s('designacion_dpo', 'Identidad y datos de contacto del DPO'),
        frasesLegales: fl('designacion_dpo', 'Identidad y datos de contacto del DPO'),
        validado: false,
      },
      {
        name: 'Funciones y responsabilidades definidas',
        keywords: ['funciones','responsabilidades','tareas dpo'],
        synonyms: s('designacion_dpo', 'Funciones y responsabilidades definidas'),
        frasesLegales: fl('designacion_dpo', 'Funciones y responsabilidades definidas'),
        validado: false,
      },
      {
        name: 'Independencia y recursos asignados',
        keywords: ['independencia','recursos','acceso','sin conflicto'],
        synonyms: s('designacion_dpo', 'Independencia y recursos asignados'),
        frasesLegales: fl('designacion_dpo', 'Independencia y recursos asignados'),
        validado: false,
      },
      {
        name: 'Notificación a la APDP realizada',
        keywords: ['notificado','comunicado','registrado','apdp'],
        synonyms: s('designacion_dpo', 'Notificación a la APDP realizada'),
        frasesLegales: fl('designacion_dpo', 'Notificación a la APDP realizada'),
        validado: false,
      },
    ],
    clasificacion: {
      marcadoresPerformativos: [
        'hemos designado como delegado de protección', 'el delegado de protección de datos nombrado',
        'nuestro dpo es', 'el dpo de esta organización es',
        'hemos nombrado a', 'el delegado designado es',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'según el artículo', 'el responsable debe designar',
          'la normativa obliga', 'la obligación de designar', 'conforme al artículo',
        ],
        tier2: [
          'proceso de designación', 'convocatoria para dpo',
          'criterios de selección', 'perfil requerido para el dpo',
        ],
      },
    },
  },
];
