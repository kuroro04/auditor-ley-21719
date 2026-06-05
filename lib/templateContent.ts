// Contenido de las plantillas de documentos legales para la Ley 21.719
// Cada sección representa una parte obligatoria del documento

export interface SeccionPlantilla {
  titulo: string;
  instruccion: string;   // Guía para quien completa el documento
  placeholder: string;  // Texto por defecto o "[COMPLETAR]"
  obligatorio: boolean;
}

export interface ContenidoPlantilla {
  reqId: string;
  titulo: string;
  articulo: string;
  proposito: string;    // Qué debe lograr este documento
  notas: string[];      // Notas legales al pie
  secciones: SeccionPlantilla[];
}

export const TEMPLATES: Record<string, ContenidoPlantilla> = {

  politica_privacidad: {
    reqId: 'politica_privacidad',
    titulo: 'Política de Privacidad y Protección de Datos Personales',
    articulo: 'Artículo 14 — Ley 21.719 de Protección de Datos Personales',
    proposito: 'Este documento informa a los titulares de datos personales sobre el tratamiento que realiza la empresa, en cumplimiento del deber de información establecido en la Ley 21.719.',
    notas: [
      'Este documento debe estar publicado y ser accesible antes o al momento de recopilar datos personales.',
      'Debe redactarse en lenguaje claro y comprensible para el ciudadano promedio.',
      'Debe actualizarse cada vez que cambien las prácticas de tratamiento de datos.',
    ],
    secciones: [
      {
        titulo: '1. Identidad y datos de contacto del Responsable',
        instruccion: 'Indique la razón social, RUT, domicilio y contacto de privacidad de su empresa.',
        placeholder: 'Razón social: [COMPLETAR]\nRUT: [COMPLETAR]\nDomicilio: [COMPLETAR]\nCorreo de privacidad: [COMPLETAR]\nTeléfono: [COMPLETAR]',
        obligatorio: true,
      },
      {
        titulo: '2. Finalidad y base legal del tratamiento',
        instruccion: 'Describa para qué se usan los datos y cuál es la base legal (consentimiento, contrato, interés legítimo, obligación legal).',
        placeholder: 'Los datos personales que recopilamos son tratados con las siguientes finalidades:\n\n• [COMPLETAR finalidad 1] — Base legal: [COMPLETAR]\n• [COMPLETAR finalidad 2] — Base legal: [COMPLETAR]\n\nNo utilizaremos sus datos para finalidades distintas a las descritas sin informarle previamente.',
        obligatorio: true,
      },
      {
        titulo: '3. Categorías de datos personales tratados',
        instruccion: 'Liste los tipos de datos que recopila (nombre, RUT, correo, datos bancarios, datos de salud, etc.).',
        placeholder: 'Tratamos las siguientes categorías de datos personales:\n\n• Datos de identificación: [COMPLETAR — ej: nombre, RUT, fecha de nacimiento]\n• Datos de contacto: [COMPLETAR — ej: correo electrónico, teléfono, dirección]\n• Datos económicos: [COMPLETAR si aplica]\n• Datos sensibles: [COMPLETAR si aplica, o indicar "No tratamos datos sensibles"]',
        obligatorio: true,
      },
      {
        titulo: '4. Derechos ARCO del titular',
        instruccion: 'Informe al titular sobre sus derechos y cómo ejercerlos. Este texto base puede usarse directamente.',
        placeholder: 'De conformidad con los artículos 11 a 13 de la Ley 21.719, usted tiene los siguientes derechos:\n\n• Derecho de Acceso: Solicitar información sobre los datos que tratamos sobre usted.\n• Derecho de Rectificación: Solicitar la corrección de datos inexactos o incompletos.\n• Derecho de Cancelación/Supresión: Solicitar la eliminación de sus datos cuando ya no sean necesarios.\n• Derecho de Oposición: Oponerse al tratamiento de sus datos en determinadas circunstancias.\n• Derecho a la Portabilidad: Recibir sus datos en formato electrónico estructurado.\n\nPara ejercer estos derechos, contáctenos en: [COMPLETAR correo/formulario]\nResponderemos su solicitud en un plazo máximo de 30 días hábiles.',
        obligatorio: true,
      },
      {
        titulo: '5. Plazo de conservación de los datos',
        instruccion: 'Indique cuánto tiempo se conservan los datos según su finalidad.',
        placeholder: 'Conservaremos sus datos personales durante el tiempo necesario para cumplir la finalidad para la cual fueron recopilados:\n\n• [Tipo de dato]: [COMPLETAR plazo] desde [COMPLETAR evento que inicia el plazo]\n• [Tipo de dato]: [COMPLETAR plazo]\n\nTranscurridos estos plazos, los datos serán eliminados de forma segura e irreversible.',
        obligatorio: true,
      },
      {
        titulo: '6. Transferencias internacionales (si aplica)',
        instruccion: 'Si transfiere datos fuera de Chile, debe informarlo aquí. Si no aplica, puede eliminar esta sección.',
        placeholder: '[OPCIÓN A — No aplica]\nNo realizamos transferencias internacionales de datos personales.\n\n[OPCIÓN B — Si aplica]\nSus datos pueden ser transferidos a los siguientes países: [COMPLETAR]\nLos destinatarios han adoptado las siguientes garantías adecuadas: [COMPLETAR]',
        obligatorio: false,
      },
      {
        titulo: '7. Modificaciones a esta política',
        instruccion: 'Indique cómo se notifican los cambios. Este texto base puede usarse directamente.',
        placeholder: 'Nos reservamos el derecho de modificar esta Política de Privacidad. Cualquier cambio significativo será notificado mediante [COMPLETAR — ej: correo electrónico / aviso en nuestro sitio web] con al menos 15 días de anticipación.',
        obligatorio: true,
      },
    ],
  },

  contrato_encargado: {
    reqId: 'contrato_encargado',
    titulo: 'Contrato de Tratamiento de Datos Personales con Encargado',
    articulo: 'Artículo 25 — Ley 21.719 de Protección de Datos Personales',
    proposito: 'Este contrato regula el tratamiento de datos personales realizado por un proveedor externo (encargado) en nombre de la empresa (responsable), en cumplimiento del artículo 25 de la Ley 21.719.',
    notas: [
      'Debe suscribirse con CADA proveedor que procese datos personales en su nombre (cloud, CRM, nómina, marketing, etc.).',
      'Puede incorporarse como cláusula adicional a contratos de servicio existentes.',
      'El encargado solo puede tratar datos según las instrucciones del responsable.',
    ],
    secciones: [
      {
        titulo: '1. Partes del contrato',
        instruccion: 'Identifique al responsable (su empresa) y al encargado (el proveedor).',
        placeholder: 'RESPONSABLE DEL TRATAMIENTO:\nRazón social: [COMPLETAR]\nRUT: [COMPLETAR]\nDomicilio: [COMPLETAR]\nRepresentante legal: [COMPLETAR]\n\nENCARGADO DEL TRATAMIENTO:\nRazón social: [COMPLETAR]\nRUT/Identificación: [COMPLETAR]\nDomicilio: [COMPLETAR]\nRepresentante legal: [COMPLETAR]',
        obligatorio: true,
      },
      {
        titulo: '2. Objeto y alcance del tratamiento',
        instruccion: 'Describa exactamente qué datos tratará el encargado y para qué servicio.',
        placeholder: 'El Encargado tratará datos personales exclusivamente para la prestación del siguiente servicio:\n\nServicio: [COMPLETAR — ej: gestión de nómina / envío de campañas de email]\nCategorías de datos involucrados: [COMPLETAR]\nCategorías de titulares afectados: [COMPLETAR — ej: empleados / clientes]\nNúmero aproximado de titulares: [COMPLETAR]',
        obligatorio: true,
      },
      {
        titulo: '3. Duración del tratamiento',
        instruccion: 'Indique por cuánto tiempo el encargado podrá tratar los datos.',
        placeholder: 'El presente contrato tendrá una duración de [COMPLETAR — ej: la vigencia del contrato de servicios firmado con fecha ___]. Una vez terminado el contrato, el encargado deberá devolver o destruir todos los datos personales tratados en el plazo de [COMPLETAR — ej: 30 días hábiles].',
        obligatorio: true,
      },
      {
        titulo: '4. Instrucciones del responsable',
        instruccion: 'Detalle qué puede y qué no puede hacer el encargado con los datos.',
        placeholder: 'El Encargado tratará los datos personales ÚNICAMENTE según las instrucciones documentadas del Responsable. Queda expresamente prohibido:\n\n• Usar los datos para finalidades propias del Encargado.\n• Ceder, vender o transferir los datos a terceros sin autorización previa y escrita.\n• Realizar tratamientos distintos a los indicados en la cláusula 2.\n\nInstrucciones específicas aplicables: [COMPLETAR si corresponde]',
        obligatorio: true,
      },
      {
        titulo: '5. Confidencialidad y secreto',
        instruccion: 'Cláusula de confidencialidad para el personal del encargado.',
        placeholder: 'El Encargado se obliga a mantener confidencialidad sobre los datos personales a los que tenga acceso en el marco de este contrato. Esta obligación se extiende a todo el personal del Encargado que trate dichos datos. El deber de confidencialidad subsistirá incluso después de la terminación del contrato.',
        obligatorio: true,
      },
      {
        titulo: '6. Medidas de seguridad',
        instruccion: 'Indique qué medidas técnicas y organizativas debe aplicar el encargado.',
        placeholder: 'El Encargado implementará y mantendrá las siguientes medidas de seguridad técnicas y organizativas:\n\n• Cifrado de datos en tránsito y en reposo: [COMPLETAR especificaciones]\n• Control de acceso y autenticación: [COMPLETAR]\n• Registros de acceso y auditoría: [COMPLETAR]\n• Plan de respaldo y recuperación: [COMPLETAR]\n• Certificaciones de seguridad vigentes: [COMPLETAR — ej: ISO 27001, SOC 2]',
        obligatorio: true,
      },
      {
        titulo: '7. Subcontratación',
        instruccion: 'Indique si el encargado puede subcontratar el tratamiento y bajo qué condiciones.',
        placeholder: '[OPCIÓN A — Sin subcontratación]\nEl Encargado no podrá subcontratar ninguna actividad de tratamiento de datos personales sin autorización previa y escrita del Responsable.\n\n[OPCIÓN B — Con subcontratación autorizada]\nEl Encargado podrá subcontratar a los siguientes proveedores previamente autorizados: [COMPLETAR]. Cualquier subcontratación adicional requerirá autorización previa del Responsable.',
        obligatorio: true,
      },
    ],
  },

  plan_brechas: {
    reqId: 'plan_brechas',
    titulo: 'Plan de Respuesta ante Brechas de Seguridad de Datos Personales',
    articulo: 'Artículo 40 — Ley 21.719 de Protección de Datos Personales',
    proposito: 'Este plan establece los procedimientos que debe seguir la organización ante una brecha de seguridad que afecte datos personales, incluyendo la notificación obligatoria a la APDP en 72 horas.',
    notas: [
      'El plazo de 72 horas para notificar a la APDP es improrrogable y comienza desde que se tiene conocimiento de la brecha.',
      'La notificación a titulares es obligatoria cuando la brecha supone un alto riesgo para sus derechos.',
      'Este plan debe revisarse y actualizarse anualmente y tras cada incidente.',
    ],
    secciones: [
      {
        titulo: '1. Alcance y definiciones',
        instruccion: 'Defina qué se entiende por brecha de seguridad en el contexto de su organización.',
        placeholder: 'Este plan aplica a [COMPLETAR — ej: toda la organización / las áreas de TI y Operaciones] y cubre toda brecha de seguridad que afecte datos personales tratados por [COMPLETAR — nombre empresa].\n\nSe entiende por brecha de seguridad: cualquier incidente que provoque, de forma accidental o ilícita, la destrucción, pérdida, alteración, divulgación no autorizada o acceso no autorizado a datos personales.',
        obligatorio: true,
      },
      {
        titulo: '2. Equipo de respuesta ante incidentes',
        instruccion: 'Designe las personas responsables de gestionar una brecha.',
        placeholder: 'Coordinador de respuesta (DPO o responsable designado):\nNombre: [COMPLETAR]\nCargo: [COMPLETAR]\nContacto: [COMPLETAR]\n\nEquipo de respuesta técnica:\n• [COMPLETAR nombre y cargo]\n• [COMPLETAR nombre y cargo]\n\nResponsable de comunicaciones externas:\nNombre: [COMPLETAR]\nContacto: [COMPLETAR]',
        obligatorio: true,
      },
      {
        titulo: '3. Procedimiento de detección y clasificación',
        instruccion: 'Describa cómo se detecta y clasifica la gravedad de un incidente.',
        placeholder: 'Paso 1 — Detección: Los incidentes pueden ser detectados mediante:\n• [COMPLETAR — ej: sistema de monitoreo, alerta de empleado, notificación de proveedor]\n\nPaso 2 — Reporte inicial: Todo incidente detectado debe reportarse al Coordinador en un plazo máximo de [COMPLETAR — ej: 4 horas] mediante [COMPLETAR — ej: correo a incidentes@empresa.cl / llamada al +56 9 XXXX XXXX].\n\nPaso 3 — Clasificación de gravedad:\n• ALTA: Acceso no autorizado a datos sensibles o a más de [COMPLETAR N] titulares.\n• MEDIA: Acceso a datos personales ordinarios con impacto limitado.\n• BAJA: Incidente contenido sin acceso externo confirmado.',
        obligatorio: true,
      },
      {
        titulo: '4. Protocolo de notificación a la APDP (72 horas)',
        instruccion: 'Detalle el proceso de notificación obligatoria a la Agencia de Protección de Datos.',
        placeholder: 'Desde el momento en que se tiene conocimiento de una brecha que pueda generar riesgos para los titulares, la organización dispone de 72 horas para notificar a la APDP.\n\nContenido mínimo de la notificación (Art. 40 Ley 21.719):\n1. Descripción de la naturaleza de la brecha.\n2. Categorías y número aproximado de titulares afectados.\n3. Categorías y número aproximado de registros afectados.\n4. Nombre y datos de contacto del DPO o punto de contacto.\n5. Consecuencias probables de la brecha.\n6. Medidas adoptadas o propuestas para remediar la brecha.\n\nCanal de notificación a la APDP: [COMPLETAR — consultar sitio web apdp.cl]\nResponsable de enviar la notificación: [COMPLETAR]',
        obligatorio: true,
      },
      {
        titulo: '5. Comunicación a titulares afectados',
        instruccion: 'Indique cuándo y cómo se comunicará a las personas cuyos datos se vieron afectados.',
        placeholder: 'Se comunicará a los titulares afectados cuando la brecha suponga un alto riesgo para sus derechos y libertades. La comunicación debe realizarse sin dilación indebida e incluir:\n\n• Descripción clara de lo ocurrido en lenguaje comprensible.\n• Datos de contacto del DPO.\n• Consecuencias probables.\n• Medidas adoptadas para mitigar el impacto.\n\nCanal de comunicación a titulares: [COMPLETAR — ej: correo electrónico / carta certificada]\nPlantilla de comunicación: [COMPLETAR o adjuntar]',
        obligatorio: true,
      },
    ],
  },

  procedimiento_arco: {
    reqId: 'procedimiento_arco',
    titulo: 'Procedimiento para el Ejercicio de Derechos ARCO',
    articulo: 'Artículos 11–13 — Ley 21.719 de Protección de Datos Personales',
    proposito: 'Este procedimiento establece el proceso interno para atender solicitudes de los titulares que deseen ejercer sus derechos de acceso, rectificación, cancelación y oposición, garantizando respuesta en el plazo legal de 30 días hábiles.',
    notas: [
      'El plazo máximo de respuesta es de 30 días hábiles desde la recepción de la solicitud.',
      'La respuesta es gratuita para el titular.',
      'En caso de denegación, el titular puede recurrir ante la APDP.',
    ],
    secciones: [
      {
        titulo: '1. Canal formal de recepción de solicitudes',
        instruccion: 'Indique cómo pueden los titulares enviar sus solicitudes.',
        placeholder: 'Los titulares de datos personales pueden ejercer sus derechos mediante:\n\n• Correo electrónico: [COMPLETAR — ej: privacidad@empresa.cl]\n• Formulario web: [COMPLETAR URL si aplica]\n• Carta física dirigida a: [COMPLETAR dirección]\n\nHorario de atención: [COMPLETAR]\nResponsable de recepción: [COMPLETAR nombre y cargo]',
        obligatorio: true,
      },
      {
        titulo: '2. Verificación de identidad del solicitante',
        instruccion: 'Describa cómo se verifica que quien pide es el titular o su representante.',
        placeholder: 'Antes de procesar cualquier solicitud, se verificará la identidad del solicitante mediante:\n\n• Para personas naturales: [COMPLETAR — ej: copia de cédula de identidad / verificación por correo registrado]\n• Para representantes legales: [COMPLETAR — ej: poder notarial + cédula del representante]\n\nEn caso de duda fundada sobre la identidad, se podrá solicitar documentación adicional dentro de los primeros [COMPLETAR — ej: 5] días hábiles.',
        obligatorio: true,
      },
      {
        titulo: '3. Registro y acuse de recibo',
        instruccion: 'Indique cómo se registran las solicitudes y cómo se confirma su recepción.',
        placeholder: 'Toda solicitud recibida será registrada en [COMPLETAR — ej: planilla de control / sistema interno] con:\n• Fecha y hora de recepción.\n• Tipo de derecho solicitado.\n• Datos de contacto del solicitante.\n• Número de ticket o folio correlativo.\n\nSe enviará acuse de recibo al solicitante dentro de [COMPLETAR — ej: 2 días hábiles] con el número de folio asignado.',
        obligatorio: true,
      },
      {
        titulo: '4. Procedimiento de acceso (Derecho de Acceso)',
        instruccion: 'Detalle cómo se atiende una solicitud de acceso a los propios datos.',
        placeholder: 'Ante una solicitud de acceso, el responsable deberá:\n\n1. Identificar todos los sistemas y bases de datos donde se traten datos del titular.\n2. Compilar la información requerida en un formato comprensible.\n3. Responder dentro de 30 días hábiles indicando:\n   a) Categorías de datos tratados.\n   b) Finalidades del tratamiento.\n   c) Destinatarios o categorías de destinatarios.\n   d) Período de conservación previsto.\n\nFormato de respuesta: [COMPLETAR — ej: correo electrónico con informe adjunto / acceso a portal]',
        obligatorio: true,
      },
      {
        titulo: '5. Procedimiento de rectificación y supresión',
        instruccion: 'Describa el proceso para corregir o eliminar datos inexactos o innecesarios.',
        placeholder: 'RECTIFICACIÓN:\nAnte datos inexactos, incompletos o desactualizados, el responsable procederá a:\n1. Verificar la inexactitud con la documentación aportada por el titular.\n2. Corregir los datos en todos los sistemas donde se encuentren.\n3. Notificar la corrección al titular y, si corresponde, a los destinatarios de los datos.\n\nSUPRESIÓN / CANCELACIÓN:\nEl titular puede solicitar la eliminación de sus datos cuando:\n• Ya no sean necesarios para la finalidad que motivó su recopilación.\n• El titular retire su consentimiento (si era la base legal).\n• Los datos hayan sido tratados ilícitamente.\n\nPlazo para completar la supresión: [COMPLETAR — ej: 10 días hábiles desde la resolución favorable]',
        obligatorio: true,
      },
    ],
  },
};
