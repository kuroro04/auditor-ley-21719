// Contenido de las plantillas de documentos legales para la Ley 21.719
// Cada sección representa una parte obligatoria del documento

export interface SeccionPlantilla {
  titulo: string;
  porQue: string;        // Por qué la ley exige esta sección y qué riesgo legal cubre
  instruccion: string;   // Guía para quien completa el documento
  placeholder: string;  // Texto por defecto o "[COMPLETAR]"
  obligatorio: boolean;
}

export interface ContenidoPlantilla {
  reqId: string;
  titulo: string;
  articulo: string;
  proposito: string;    // Qué debe lograr este documento
  checklist: string[];  // Verificación final antes de usar el documento
  notas: string[];      // Notas legales al pie
  secciones: SeccionPlantilla[];
}

export const TEMPLATES: Record<string, ContenidoPlantilla> = {

  politica_privacidad: {
    reqId: 'politica_privacidad',
    titulo: 'Política de Privacidad y Protección de Datos Personales',
    articulo: 'Artículo 14 — Ley 21.719 de Protección de Datos Personales',
    proposito: 'Este documento informa a los titulares de datos personales sobre el tratamiento que realiza la empresa, en cumplimiento del deber de información establecido en la Ley 21.719.',
    checklist: [
      '¿Publicó esta política en un lugar visible y accesible antes de recolectar datos?',
      '¿Completó los 7 campos [COMPLETAR] con información real de su empresa?',
      '¿Un responsable de privacidad revisó el texto final?',
      '¿La política está redactada en lenguaje simple, sin tecnicismos innecesarios?',
      '¿Definió un canal de contacto real y monitoreado para solicitudes ARCO?',
    ],
    notas: [
      'Este documento debe estar publicado y ser accesible antes o al momento de recopilar datos personales.',
      'Debe redactarse en lenguaje claro y comprensible para el ciudadano promedio.',
      'Debe actualizarse cada vez que cambien las prácticas de tratamiento de datos.',
    ],
    secciones: [
      {
        titulo: '1. Identidad y datos de contacto del Responsable',
        porQue: 'El titular debe saber exactamente quién trata sus datos y a quién reclamar. Omitir esto impide ejercer cualquier derecho ARCO y es de lo primero que fiscaliza la APDP.',
        instruccion: 'Indique la razón social, RUT, domicilio y contacto de privacidad de su empresa.',
        placeholder: 'Razón social: [COMPLETAR] (ej: Comercializadora Andina SpA)\nRUT: [COMPLETAR] (ej: 76.123.456-7)\nDomicilio: [COMPLETAR] (ej: Av. Apoquindo 1234, Las Condes, Santiago)\nCorreo de privacidad: [COMPLETAR] (ej: privacidad@suempresa.cl)\nTeléfono: [COMPLETAR] (ej: +56 2 2345 6789)',
        obligatorio: true,
      },
      {
        titulo: '2. Finalidad y base legal del tratamiento',
        porQue: 'Tratar datos sin finalidad declarada o sin base legal válida es la infracción más común y más sancionada de la Ley 21.719; cada finalidad necesita su propio fundamento legal.',
        instruccion: 'Describa para qué se usan los datos y cuál es la base legal (consentimiento, contrato, interés legítimo, obligación legal).',
        placeholder: 'Los datos personales que recopilamos son tratados con las siguientes finalidades:\n\n• [COMPLETAR finalidad 1] — Base legal: [COMPLETAR]\n• [COMPLETAR finalidad 2] — Base legal: [COMPLETAR]\n\nNo utilizaremos sus datos para finalidades distintas a las descritas sin informarle previamente.',
        obligatorio: true,
      },
      {
        titulo: '3. Categorías de datos personales tratados',
        porQue: 'El titular no puede evaluar el riesgo de entregar sus datos si no sabe qué tipo de datos recopila la empresa; ocultar el uso de datos sensibles agrava cualquier sanción.',
        instruccion: 'Liste los tipos de datos que recopila (nombre, RUT, correo, datos bancarios, datos de salud, etc.).',
        placeholder: 'Tratamos las siguientes categorías de datos personales:\n\n• Datos de identificación: [COMPLETAR — ej: nombre, RUT, fecha de nacimiento]\n• Datos de contacto: [COMPLETAR — ej: correo electrónico, teléfono, dirección]\n• Datos económicos: [COMPLETAR si aplica]\n• Datos sensibles: [COMPLETAR si aplica, o indicar "No tratamos datos sensibles"]',
        obligatorio: true,
      },
      {
        titulo: '4. Derechos ARCO del titular',
        porQue: 'La ley exige informar proactivamente estos derechos (Art. 11–13); no basta con que existan, el titular debe conocerlos para poder ejercerlos.',
        instruccion: 'Informe al titular sobre sus derechos y cómo ejercerlos. Este texto base puede usarse directamente.',
        placeholder: 'De conformidad con los artículos 11 a 13 de la Ley 21.719, usted tiene los siguientes derechos:\n\n• Derecho de Acceso: Solicitar información sobre los datos que tratamos sobre usted.\n• Derecho de Rectificación: Solicitar la corrección de datos inexactos o incompletos.\n• Derecho de Cancelación/Supresión: Solicitar la eliminación de sus datos cuando ya no sean necesarios.\n• Derecho de Oposición: Oponerse al tratamiento de sus datos en determinadas circunstancias.\n• Derecho a la Portabilidad: Recibir sus datos en formato electrónico estructurado.\n\nPara ejercer estos derechos, contáctenos en: [COMPLETAR correo/formulario]\nResponderemos su solicitud en un plazo máximo de 30 días hábiles.',
        obligatorio: true,
      },
      {
        titulo: '5. Plazo de conservación de los datos',
        porQue: 'Guardar datos indefinidamente viola el principio de limitación del plazo de conservación (Art. 7) y aumenta el daño potencial de cualquier brecha de seguridad.',
        instruccion: 'Indique cuánto tiempo se conservan los datos según su finalidad.',
        placeholder: 'Conservaremos sus datos personales durante el tiempo necesario para cumplir la finalidad para la cual fueron recopilados:\n\n• Datos de clientes: [COMPLETAR plazo, ej: 5 años] desde [COMPLETAR evento, ej: término de la relación comercial]\n• Datos de postulantes a empleo: [COMPLETAR plazo, ej: 6 meses] desde [COMPLETAR evento, ej: cierre del proceso de selección]\n\nTranscurridos estos plazos, los datos serán eliminados de forma segura e irreversible.',
        obligatorio: true,
      },
      {
        titulo: '6. Transferencias internacionales (si aplica)',
        porQue: 'Enviar datos a países sin nivel adecuado de protección sin informarlo expone a la empresa a responsabilidad solidaria por el mal uso que haga el tercero.',
        instruccion: 'Si transfiere datos fuera de Chile, debe informarlo aquí. Si no aplica, puede eliminar esta sección.',
        placeholder: '[OPCIÓN A — No aplica]\nNo realizamos transferencias internacionales de datos personales.\n\n[OPCIÓN B — Si aplica]\nSus datos pueden ser transferidos a los siguientes países: [COMPLETAR]\nLos destinatarios han adoptado las siguientes garantías adecuadas: [COMPLETAR]',
        obligatorio: false,
      },
      {
        titulo: '7. Modificaciones a esta política',
        porQue: 'Si la política cambia sin aviso, el tratamiento deja de tener el consentimiento o la información válida que lo amparaba originalmente.',
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
    checklist: [
      '¿Firmó este contrato (o cláusula) con TODOS los proveedores que procesan datos personales en su nombre?',
      '¿Verificó que el encargado cuenta con las medidas de seguridad declaradas en la cláusula 6?',
      '¿Definió qué pasa con los datos al terminar el contrato (devolución o destrucción)?',
      '¿El representante legal de ambas partes firmó el documento?',
    ],
    notas: [
      'Debe suscribirse con CADA proveedor que procese datos personales en su nombre (cloud, CRM, nómina, marketing, etc.).',
      'Puede incorporarse como cláusula adicional a contratos de servicio existentes.',
      'El encargado solo puede tratar datos según las instrucciones del responsable.',
    ],
    secciones: [
      {
        titulo: '1. Partes del contrato',
        porQue: 'El Art. 25 exige identificar con precisión quién es responsable y quién es encargado; sin esto no hay forma de determinar quién responde ante una infracción.',
        instruccion: 'Identifique al responsable (su empresa) y al encargado (el proveedor).',
        placeholder: 'RESPONSABLE DEL TRATAMIENTO:\nRazón social: [COMPLETAR] (ej: Comercializadora Andina SpA)\nRUT: [COMPLETAR] (ej: 76.123.456-7)\nDomicilio: [COMPLETAR] (ej: Av. Apoquindo 1234, Las Condes, Santiago)\nRepresentante legal: [COMPLETAR] (ej: Juan Pérez Soto)\n\nENCARGADO DEL TRATAMIENTO:\nRazón social: [COMPLETAR] (ej: Nube Segura Cloud Services Ltda.)\nRUT/Identificación: [COMPLETAR] (ej: 77.987.654-3)\nDomicilio: [COMPLETAR] (ej: Av. Providencia 999, Providencia, Santiago)\nRepresentante legal: [COMPLETAR] (ej: Carolina Reyes Fuentes)',
        obligatorio: true,
      },
      {
        titulo: '2. Objeto y alcance del tratamiento',
        porQue: 'Un encargado solo puede tratar los datos que el contrato autorice expresamente; sin este detalle, cualquier uso adicional es tratamiento ilícito.',
        instruccion: 'Describa exactamente qué datos tratará el encargado y para qué servicio.',
        placeholder: 'El Encargado tratará datos personales exclusivamente para la prestación del siguiente servicio:\n\nServicio: [COMPLETAR — ej: gestión de nómina / envío de campañas de email]\nCategorías de datos involucrados: [COMPLETAR]\nCategorías de titulares afectados: [COMPLETAR — ej: empleados / clientes]\nNúmero aproximado de titulares: [COMPLETAR]',
        obligatorio: true,
      },
      {
        titulo: '3. Duración del tratamiento',
        porQue: 'Sin un plazo y un destino final de los datos, el encargado podría conservarlos indefinidamente incluso después de terminar el servicio.',
        instruccion: 'Indique por cuánto tiempo el encargado podrá tratar los datos.',
        placeholder: 'El presente contrato tendrá una duración de [COMPLETAR — ej: la vigencia del contrato de servicios firmado con fecha ___]. Una vez terminado el contrato, el encargado deberá devolver o destruir todos los datos personales tratados en el plazo de [COMPLETAR — ej: 30 días hábiles].',
        obligatorio: true,
      },
      {
        titulo: '4. Instrucciones del responsable',
        porQue: 'El encargado no tiene autonomía legal sobre los datos; si actúa fuera de instrucciones documentadas, pasa a ser responsable solidario del mal uso.',
        instruccion: 'Detalle qué puede y qué no puede hacer el encargado con los datos.',
        placeholder: 'El Encargado tratará los datos personales ÚNICAMENTE según las instrucciones documentadas del Responsable. Queda expresamente prohibido:\n\n• Usar los datos para finalidades propias del Encargado.\n• Ceder, vender o transferir los datos a terceros sin autorización previa y escrita.\n• Realizar tratamientos distintos a los indicados en la cláusula 2.\n\nInstrucciones específicas aplicables: [COMPLETAR si corresponde, ej: acceso restringido solo al equipo de soporte nivel 2]',
        obligatorio: true,
      },
      {
        titulo: '5. Confidencialidad y secreto',
        porQue: 'El personal del encargado accede a datos de personas con las que no tiene relación directa; sin esta cláusula no existe obligación legal de reserva.',
        instruccion: 'Cláusula de confidencialidad para el personal del encargado.',
        placeholder: 'El Encargado se obliga a mantener confidencialidad sobre los datos personales a los que tenga acceso en el marco de este contrato. Esta obligación se extiende a todo el personal del Encargado que trate dichos datos. El deber de confidencialidad subsistirá incluso después de la terminación del contrato.',
        obligatorio: true,
      },
      {
        titulo: '6. Medidas de seguridad',
        porQue: 'El Art. 25 exige que el encargado ofrezca garantías suficientes de seguridad; sin especificarlas, el responsable no puede acreditar que evaluó ese riesgo.',
        instruccion: 'Indique qué medidas técnicas y organizativas debe aplicar el encargado.',
        placeholder: 'El Encargado implementará y mantendrá las siguientes medidas de seguridad técnicas y organizativas:\n\n• Cifrado de datos en tránsito y en reposo: [COMPLETAR especificaciones]\n• Control de acceso y autenticación: [COMPLETAR]\n• Registros de acceso y auditoría: [COMPLETAR]\n• Plan de respaldo y recuperación: [COMPLETAR]\n• Certificaciones de seguridad vigentes: [COMPLETAR — ej: ISO 27001, SOC 2]',
        obligatorio: true,
      },
      {
        titulo: '7. Subcontratación',
        porQue: 'Si el encargado subcontrata sin autorización, los datos terminan en manos de un tercero que el responsable nunca evaluó ni controló.',
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
    checklist: [
      '¿Los datos de contacto del Coordinador de respuesta están actualizados y disponibles 24/7?',
      '¿Todo el equipo sabe qué hacer en las primeras horas tras detectar un incidente?',
      '¿Conoce el canal oficial de notificación a la APDP (apdp.cl)?',
      '¿Existe una plantilla lista para comunicar la brecha a los titulares afectados?',
      '¿Este plan se revisó en los últimos 12 meses?',
    ],
    notas: [
      'El plazo de 72 horas para notificar a la APDP es improrrogable y comienza desde que se tiene conocimiento de la brecha.',
      'La notificación a titulares es obligatoria cuando la brecha supone un alto riesgo para sus derechos.',
      'Este plan debe revisarse y actualizarse anualmente y tras cada incidente.',
    ],
    secciones: [
      {
        titulo: '1. Alcance y definiciones',
        porQue: 'Sin una definición clara de qué es una "brecha", el equipo puede no reconocer un incidente real como tal y perder el plazo de 72 horas sin darse cuenta.',
        instruccion: 'Defina qué se entiende por brecha de seguridad en el contexto de su organización.',
        placeholder: 'Este plan aplica a [COMPLETAR — ej: toda la organización / las áreas de TI y Operaciones] y cubre toda brecha de seguridad que afecte datos personales tratados por [COMPLETAR — nombre empresa].\n\nSe entiende por brecha de seguridad: cualquier incidente que provoque, de forma accidental o ilícita, la destrucción, pérdida, alteración, divulgación no autorizada o acceso no autorizado a datos personales.',
        obligatorio: true,
      },
      {
        titulo: '2. Equipo de respuesta ante incidentes',
        porQue: 'Ante una brecha real, la falta de responsables designados es la causa más común de que la notificación a la APDP se retrase o simplemente no ocurra.',
        instruccion: 'Designe las personas responsables de gestionar una brecha.',
        placeholder: 'Coordinador de respuesta (DPO o responsable designado):\nNombre: [COMPLETAR] (ej: María González Rojas)\nCargo: [COMPLETAR] (ej: Gerente de Operaciones)\nContacto: [COMPLETAR] (ej: maria.gonzalez@suempresa.cl / +56 9 8765 4321)\n\nEquipo de respuesta técnica:\n• [COMPLETAR nombre y cargo, ej: Pedro Soto — Jefe de TI]\n• [COMPLETAR nombre y cargo]\n\nResponsable de comunicaciones externas:\nNombre: [COMPLETAR] (ej: Andrea Muñoz Silva)\nContacto: [COMPLETAR] (ej: prensa@suempresa.cl)',
        obligatorio: true,
      },
      {
        titulo: '3. Procedimiento de detección y clasificación',
        porQue: 'El plazo de 72 horas corre desde que la empresa "tiene conocimiento" del incidente; por eso se exige un procedimiento de detección y clasificación rápido y documentado.',
        instruccion: 'Describa cómo se detecta y clasifica la gravedad de un incidente.',
        placeholder: 'Paso 1 — Detección: Los incidentes pueden ser detectados mediante:\n• [COMPLETAR — ej: sistema de monitoreo, alerta de empleado, notificación de proveedor]\n\nPaso 2 — Reporte inicial: Todo incidente detectado debe reportarse al Coordinador en un plazo máximo de [COMPLETAR — ej: 4 horas] mediante [COMPLETAR — ej: correo a incidentes@empresa.cl / llamada al +56 9 XXXX XXXX].\n\nPaso 3 — Clasificación de gravedad:\n• ALTA: Acceso no autorizado a datos sensibles o a más de [COMPLETAR N] titulares.\n• MEDIA: Acceso a datos personales ordinarios con impacto limitado.\n• BAJA: Incidente contenido sin acceso externo confirmado.',
        obligatorio: true,
      },
      {
        titulo: '4. Protocolo de notificación a la APDP (72 horas)',
        porQue: 'El Art. 40 obliga a notificar dentro de 72 horas con un contenido mínimo específico; no cumplir el plazo o el contenido es sancionable aunque la brecha se haya contenido bien.',
        instruccion: 'Detalle el proceso de notificación obligatoria a la Agencia de Protección de Datos.',
        placeholder: 'Desde el momento en que se tiene conocimiento de una brecha que pueda generar riesgos para los titulares, la organización dispone de 72 horas para notificar a la APDP.\n\nContenido mínimo de la notificación (Art. 40 Ley 21.719):\n1. Descripción de la naturaleza de la brecha.\n2. Categorías y número aproximado de titulares afectados.\n3. Categorías y número aproximado de registros afectados.\n4. Nombre y datos de contacto del DPO o punto de contacto.\n5. Consecuencias probables de la brecha.\n6. Medidas adoptadas o propuestas para remediar la brecha.\n\nCanal de notificación a la APDP: [COMPLETAR — consultar sitio web apdp.cl]\nResponsable de enviar la notificación: [COMPLETAR]',
        obligatorio: true,
      },
      {
        titulo: '5. Comunicación a titulares afectados',
        porQue: 'Cuando el riesgo es alto para las personas, ocultarles la brecha les impide protegerse (cambiar claves, alertar a su banco) y agrava la responsabilidad de la empresa.',
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
    checklist: [
      '¿El canal de recepción de solicitudes ARCO está publicado en su política de privacidad?',
      '¿El proceso de verificación de identidad no es tan invasivo que disuada al titular de ejercer su derecho?',
      '¿Puede demostrar la fecha de recepción de cada solicitud (folio, correo, sistema)?',
      '¿El plazo de 30 días hábiles está monitoreado activamente (alertas, calendario)?',
    ],
    notas: [
      'El plazo máximo de respuesta es de 30 días hábiles desde la recepción de la solicitud.',
      'La respuesta es gratuita para el titular.',
      'En caso de denegación, el titular puede recurrir ante la APDP.',
    ],
    secciones: [
      {
        titulo: '1. Canal formal de recepción de solicitudes',
        porQue: 'Si no existe un canal claro y conocido, los titulares no pueden ejercer sus derechos y la empresa no puede demostrar que ofrece un medio de acceso real.',
        instruccion: 'Indique cómo pueden los titulares enviar sus solicitudes.',
        placeholder: 'Los titulares de datos personales pueden ejercer sus derechos mediante:\n\n• Correo electrónico: [COMPLETAR — ej: privacidad@empresa.cl]\n• Formulario web: [COMPLETAR URL, ej: www.suempresa.cl/privacidad/solicitud]\n• Carta física dirigida a: [COMPLETAR dirección, ej: Av. Apoquindo 1234, Las Condes, Santiago]\n\nHorario de atención: [COMPLETAR — ej: lunes a viernes, 9:00 a 18:00 hrs]\nResponsable de recepción: [COMPLETAR nombre y cargo, ej: Andrea Muñoz — Encargada de Privacidad]',
        obligatorio: true,
      },
      {
        titulo: '2. Verificación de identidad del solicitante',
        porQue: 'Responder a la persona equivocada es en sí mismo una filtración de datos; verificar identidad protege tanto al titular real como a la empresa.',
        instruccion: 'Describa cómo se verifica que quien pide es el titular o su representante.',
        placeholder: 'Antes de procesar cualquier solicitud, se verificará la identidad del solicitante mediante:\n\n• Para personas naturales: [COMPLETAR — ej: copia de cédula de identidad / verificación por correo registrado]\n• Para representantes legales: [COMPLETAR — ej: poder notarial + cédula del representante]\n\nEn caso de duda fundada sobre la identidad, se podrá solicitar documentación adicional dentro de los primeros [COMPLETAR — ej: 5] días hábiles.',
        obligatorio: true,
      },
      {
        titulo: '3. Registro y acuse de recibo',
        porQue: 'Sin un registro con fecha de ingreso, la empresa no puede demostrar ante la APDP que respondió dentro del plazo legal de 30 días hábiles.',
        instruccion: 'Indique cómo se registran las solicitudes y cómo se confirma su recepción.',
        placeholder: 'Toda solicitud recibida será registrada en [COMPLETAR — ej: planilla de control / sistema interno] con:\n• Fecha y hora de recepción.\n• Tipo de derecho solicitado.\n• Datos de contacto del solicitante.\n• Número de ticket o folio correlativo.\n\nSe enviará acuse de recibo al solicitante dentro de [COMPLETAR — ej: 2 días hábiles] con el número de folio asignado.',
        obligatorio: true,
      },
      {
        titulo: '4. Procedimiento de acceso (Derecho de Acceso)',
        porQue: 'El derecho de acceso (Art. 11) exige entregar información específica y completa; un proceso improvisado normalmente omite alguno de los puntos exigidos por ley.',
        instruccion: 'Detalle cómo se atiende una solicitud de acceso a los propios datos.',
        placeholder: 'Ante una solicitud de acceso, el responsable deberá:\n\n1. Identificar todos los sistemas y bases de datos donde se traten datos del titular.\n2. Compilar la información requerida en un formato comprensible.\n3. Responder dentro de 30 días hábiles indicando:\n   a) Categorías de datos tratados.\n   b) Finalidades del tratamiento.\n   c) Destinatarios o categorías de destinatarios.\n   d) Período de conservación previsto.\n\nFormato de respuesta: [COMPLETAR — ej: correo electrónico con informe adjunto / acceso a portal]',
        obligatorio: true,
      },
      {
        titulo: '5. Procedimiento de rectificación y supresión',
        porQue: 'Corregir o eliminar datos en un solo sistema pero no en otros (CRM, backups, planillas) deja el dato inexacto o indebido circulando, lo que sigue siendo una infracción.',
        instruccion: 'Describa el proceso para corregir o eliminar datos inexactos o innecesarios.',
        placeholder: 'RECTIFICACIÓN:\nAnte datos inexactos, incompletos o desactualizados, el responsable procederá a:\n1. Verificar la inexactitud con la documentación aportada por el titular.\n2. Corregir los datos en todos los sistemas donde se encuentren.\n3. Notificar la corrección al titular y, si corresponde, a los destinatarios de los datos.\n\nSUPRESIÓN / CANCELACIÓN:\nEl titular puede solicitar la eliminación de sus datos cuando:\n• Ya no sean necesarios para la finalidad que motivó su recopilación.\n• El titular retire su consentimiento (si era la base legal).\n• Los datos hayan sido tratados ilícitamente.\n\nPlazo para completar la supresión: [COMPLETAR — ej: 10 días hábiles desde la resolución favorable]',
        obligatorio: true,
      },
    ],
  },

  // ─── Registro de actividades de tratamiento ───────────────────────────────
  registro_actividades: {
    reqId: 'registro_actividades',
    titulo: 'Registro de Actividades de Tratamiento de Datos Personales',
    articulo: 'Artículo 16 — Ley 21.719 de Protección de Datos Personales',
    proposito: 'Este registro interno documenta todas las actividades en las que la empresa trata datos personales, conforme al deber de registro establecido en el Art. 16 de la Ley 21.719.',
    checklist: [
      '¿El registro incluye TODAS las actividades de tratamiento de la empresa, no solo las principales?',
      '¿Se actualiza cada vez que se incorpora un nuevo sistema, proveedor o finalidad?',
      '¿Está disponible para entregarlo a la APDP en caso de fiscalización?',
    ],
    notas: [
      'Este registro es de uso interno y debe mantenerse actualizado.',
      'Debe estar disponible para la APDP si lo solicita en el marco de una fiscalización.',
      'Actualice el registro cada vez que incorpore una nueva actividad de tratamiento.',
    ],
    secciones: [
      {
        titulo: '1. Identificación del Responsable',
        porQue: 'El registro (Art. 16) debe permitir a la APDP identificar sin ambigüedad quién es responsable de cada tratamiento que fiscalice.',
        instruccion: 'Complete los datos del responsable del tratamiento de datos.',
        placeholder: 'Razón social: [COMPLETAR] (ej: Comercializadora Andina SpA)\nRUT: [COMPLETAR] (ej: 76.123.456-7)\nDomicilio: [COMPLETAR] (ej: Av. Apoquindo 1234, Las Condes, Santiago)\nCorreo de contacto: [COMPLETAR] (ej: contacto@suempresa.cl)\nRepresentante legal: [COMPLETAR] (ej: Juan Pérez Soto)',
        obligatorio: true,
      },
      {
        titulo: '2. Actividades de Tratamiento',
        porQue: 'Sin inventariar cada actividad, la empresa no puede saber -ni demostrar- qué datos trata, para qué y con qué base legal: es la base de cualquier auditoría.',
        instruccion: 'Para cada actividad de tratamiento, complete una fila del siguiente registro. Copie y pegue la fila según la cantidad de actividades.',
        placeholder: 'Nombre de la actividad: [COMPLETAR — ej: gestión de nómina]\nCategorías de datos tratados: [COMPLETAR — ej: datos de identificación, datos financieros, datos sensibles]\nFinalidad del tratamiento: [COMPLETAR]\nBase legal: [COMPLETAR — ej: consentimiento / interés legítimo / obligación legal]\nDestinatarios o terceros receptores: [COMPLETAR — ej: proveedores de nube, entidades financieras]\nTransferencias internacionales: [COMPLETAR — Sí/No; si Sí, indicar país y garantías]\nPlazo de supresión: [COMPLETAR — ej: 5 años desde el término de la relación comercial]',
        obligatorio: true,
      },
      {
        titulo: '3. Medidas de Seguridad Aplicadas',
        porQue: 'El registro debe evidenciar que cada actividad tiene una protección proporcional a su riesgo; de lo contrario no sirve como prueba de cumplimiento.',
        instruccion: 'Describa las medidas técnicas y organizativas que protegen los datos en cada actividad.',
        placeholder: 'Cifrado en tránsito: [COMPLETAR — ej: TLS 1.2+]\nCifrado en reposo: [COMPLETAR — ej: AES-256]\nControl de acceso: [COMPLETAR — ej: autenticación de dos factores]\nRespaldo y recuperación: [COMPLETAR — ej: backups diarios cifrados]\nOtras medidas: [COMPLETAR]',
        obligatorio: true,
      },
      {
        titulo: '4. Historial de Actualizaciones',
        porQue: 'Un registro desactualizado no refleja la realidad del tratamiento y pierde valor como evidencia ante una fiscalización.',
        instruccion: 'Registre cada vez que actualice este documento.',
        placeholder: 'Fecha: [COMPLETAR] (ej: 15 de marzo de 2026) — Cambio: [COMPLETAR — ej: se agregó actividad de videovigilancia] — Responsable: [COMPLETAR nombre]',
        obligatorio: false,
      },
    ],
  },

  // ─── Evaluación de Impacto en Privacidad (EIPD) ──────────────────────────
  evaluacion_impacto: {
    reqId: 'evaluacion_impacto',
    titulo: 'Evaluación de Impacto en Protección de Datos (EIPD)',
    articulo: 'Artículo 38 — Ley 21.719 de Protección de Datos Personales',
    proposito: 'Este informe documenta el análisis formal de riesgos realizado antes de iniciar tratamientos de alto riesgo (datos sensibles, vigilancia a gran escala, biometría, IA), según exige el Art. 38 de la Ley 21.719.',
    checklist: [
      '¿Esta evaluación se hizo ANTES de iniciar el tratamiento de alto riesgo, no después?',
      '¿Se identificaron riesgos concretos para los titulares, no solo riesgos para la empresa?',
      '¿El riesgo residual final es aceptable, o requiere consulta previa a la APDP?',
      '¿Fue aprobada formalmente por el responsable o el DPO?',
    ],
    notas: [
      'La EIPD debe realizarse ANTES de iniciar el tratamiento, no después.',
      'Si el riesgo residual es alto, debe consultarse a la APDP antes de proceder.',
      'El documento debe actualizarse si cambia la naturaleza, alcance o finalidad del tratamiento.',
    ],
    secciones: [
      {
        titulo: '1. Descripción Sistemática del Tratamiento',
        porQue: 'El Art. 38 exige entender la naturaleza y escala exacta del tratamiento antes de evaluar si es riesgoso; sin esta descripción no hay evaluación real, solo un trámite de papel.',
        instruccion: 'Describa en detalle qué datos se tratan, cómo, con qué tecnología y a qué escala.',
        placeholder: 'Nombre del tratamiento: [COMPLETAR] (ej: Sistema de videovigilancia con reconocimiento facial en sucursales)\nTipos de datos involucrados: [COMPLETAR — ej: datos biométricos, datos de salud]\nEscala estimada de titulares afectados: [COMPLETAR — ej: 50.000 clientes]\nTecnologías o sistemas utilizados: [COMPLETAR]\nFlujo de datos (origen -> almacenamiento -> uso -> eliminación): [COMPLETAR]',
        obligatorio: true,
      },
      {
        titulo: '2. Evaluación de Necesidad y Proporcionalidad',
        porQue: 'La ley prohíbe tratar más datos de los necesarios; esta sección obliga a justificar que no existe una alternativa menos invasiva.',
        instruccion: 'Justifique que el tratamiento es necesario, adecuado y no excesivo para la finalidad declarada.',
        placeholder: 'Finalidad específica del tratamiento: [COMPLETAR]\n¿Es el tratamiento necesario para esa finalidad?: [COMPLETAR — justificación]\n¿Se podría lograr la misma finalidad con menos datos?: [COMPLETAR]\nMedidas de minimización aplicadas: [COMPLETAR]',
        obligatorio: true,
      },
      {
        titulo: '3. Identificación y Evaluación de Riesgos',
        porQue: 'Sin listar los riesgos concretos para las personas, la EIPD no cumple su función preventiva y la empresa avanza a ciegas con un tratamiento de alto riesgo.',
        instruccion: 'Liste los riesgos para los titulares de datos y evalúe su probabilidad e impacto.',
        placeholder: 'Riesgo 1: [COMPLETAR — descripción]\n  Probabilidad (alta/media/baja): [COMPLETAR]\n  Impacto (alto/medio/bajo): [COMPLETAR]\n\nRiesgo 2: [COMPLETAR]\n  Probabilidad: [COMPLETAR]\n  Impacto: [COMPLETAR]\n\n(Agregue tantos riesgos como sea necesario)',
        obligatorio: true,
      },
      {
        titulo: '4. Medidas de Mitigación',
        porQue: 'Identificar un riesgo sin mitigarlo no cumple el Art. 38; si el riesgo residual sigue siendo alto, la ley exige consultar a la APDP antes de continuar.',
        instruccion: 'Para cada riesgo identificado, defina las medidas que reducirán su probabilidad o impacto.',
        placeholder: 'Medida 1 (para Riesgo 1): [COMPLETAR — ej: cifrado de extremo a extremo]\nMedida 2 (para Riesgo 2): [COMPLETAR]\nRiesgo residual estimado tras medidas: [COMPLETAR — alto/medio/bajo]\nConclusión: ¿Se puede proceder con el tratamiento?: [COMPLETAR]',
        obligatorio: true,
      },
      {
        titulo: '5. Aprobación y Firma',
        porQue: 'Sin una aprobación formal del responsable o del DPO, la EIPD es solo un borrador técnico sin valor como evidencia de diligencia debida.',
        instruccion: 'La EIPD debe ser aprobada por el responsable del tratamiento o el DPO.',
        placeholder: 'Elaborado por: [COMPLETAR] (ej: Equipo de Cumplimiento)\nCargo: [COMPLETAR] (ej: Analista de Riesgos)\nFecha de elaboración: [COMPLETAR] (ej: 15 de marzo de 2026)\nAprobado por (DPO o responsable): [COMPLETAR] (ej: nombre del DPO)\nFecha de aprobación: [COMPLETAR]',
        obligatorio: true,
      },
    ],
  },

  // ─── Política de Retención y Eliminación ─────────────────────────────────
  politica_retencion: {
    reqId: 'politica_retencion',
    titulo: 'Política de Retención y Eliminación de Datos Personales',
    articulo: 'Artículo 7 — Ley 21.719 de Protección de Datos Personales',
    proposito: 'Este documento establece los plazos máximos de conservación para cada categoría de dato personal y los procedimientos de destrucción segura, en cumplimiento del principio de limitación del plazo de conservación del Art. 7.',
    checklist: [
      '¿La tabla de plazos cubre TODAS las categorías de datos que trata la empresa (clientes, empleados, marketing, proveedores)?',
      '¿Existe un responsable designado para ejecutar las eliminaciones?',
      '¿El método de destrucción es realmente irreversible (no solo "mover a la papelera")?',
      '¿Se revisó esta política en los últimos 12 meses?',
    ],
    notas: [
      'Los datos deben eliminarse tan pronto como dejen de ser necesarios para la finalidad que justificó su recopilación.',
      'La destrucción debe ser irreversible: borrado seguro, trituración o anonimización efectiva.',
      'Conserve registros de cada proceso de eliminación como evidencia de cumplimiento.',
    ],
    secciones: [
      {
        titulo: '1. Alcance y Responsable',
        porQue: 'Sin un responsable designado, ningún proceso de eliminación se ejecuta en la práctica aunque esté escrito en el papel.',
        instruccion: 'Indique a qué datos aplica esta política y quién es responsable de su cumplimiento.',
        placeholder: 'Esta política aplica a: [COMPLETAR — ej: todos los datos personales tratados por la empresa]\nResponsable del proceso de eliminación: [COMPLETAR — nombre y cargo]\nFrecuencia de revisión de la política: [COMPLETAR — ej: anual]',
        obligatorio: true,
      },
      {
        titulo: '2. Tabla de Plazos por Categoría de Dato',
        porQue: 'El Art. 7 exige un límite temporal claro para cada categoría de dato; conservarlos "indefinidamente por si acaso" es en sí mismo una infracción.',
        instruccion: 'Complete la tabla con los plazos de retención para cada tipo de dato que trate su empresa.',
        placeholder: 'Categoría: Datos de clientes — Plazo: [COMPLETAR — ej: 5 años tras el término de la relación] — Base legal: [COMPLETAR]\nCategoría: Datos de empleados — Plazo: [COMPLETAR] — Base legal: [COMPLETAR]\nCategoría: Datos de marketing — Plazo: [COMPLETAR] — Base legal: [COMPLETAR]\nCategoría: Datos de proveedores — Plazo: [COMPLETAR] — Base legal: [COMPLETAR]\n(Agregue filas según las categorías de datos que trate)',
        obligatorio: true,
      },
      {
        titulo: '3. Proceso de Revisión Periódica',
        porQue: 'Los plazos no se cumplen solos: sin una auditoría periódica, los datos vencidos simplemente se acumulan sin que nadie los elimine.',
        instruccion: 'Describa cómo y cuándo se revisa si los datos siguen siendo necesarios.',
        placeholder: 'Frecuencia de auditoría de datos almacenados: [COMPLETAR — ej: trimestral]\nResponsable de la auditoría: [COMPLETAR]\nCriterio para decidir eliminación: [COMPLETAR — ej: si han transcurrido X meses desde el último uso activo]\nRegistro de revisiones: [COMPLETAR — ej: planilla interna de auditoría]',
        obligatorio: true,
      },
      {
        titulo: '4. Método de Destrucción Segura',
        porQue: 'Eliminar un registro de la base de datos pero dejarlo en un respaldo o en papel sin destruir no constituye una eliminación real ante la ley.',
        instruccion: 'Especifique el método de eliminación irreversible para cada soporte.',
        placeholder: 'Datos digitales: [COMPLETAR — ej: borrado seguro con herramienta certificada, sobreescritura de 7 pasadas]\nDocumentos físicos: [COMPLETAR — ej: trituración con corte en partículas]\nSoportes físicos (discos, USB): [COMPLETAR — ej: destrucción física certificada]\nDatos en la nube: [COMPLETAR — ej: eliminación mediante API del proveedor con confirmación escrita]',
        obligatorio: true,
      },
    ],
  },

  // ─── Inscripción en el RNPA ───────────────────────────────────────────────
  registro_rnpa: {
    reqId: 'registro_rnpa',
    titulo: 'Acreditación de Inscripción en el Registro Nacional de Protección de Datos (RNPA)',
    articulo: 'Artículo 55 — Ley 21.719 de Protección de Datos Personales',
    proposito: 'Este documento acredita la inscripción vigente de la empresa como responsable de tratamiento en el Registro Nacional de Protección de Datos (RNPA) administrado por la APDP, conforme al Art. 55 de la Ley 21.719.',
    checklist: [
      '¿Ya completó la inscripción en el portal oficial www.apdp.cl?',
      '¿Guardó el número de inscripción y el comprobante como evidencia?',
      '¿Hay una persona responsable de verificar la vigencia periódicamente?',
    ],
    notas: [
      'La inscripción en el RNPA es obligatoria para toda empresa que trate datos personales.',
      'Debe realizarse directamente en el portal de la APDP (www.apdp.cl).',
      'Guarde el certificado o comprobante de inscripción como evidencia de cumplimiento.',
      'Renueve la inscripción según los plazos que establezca la APDP.',
    ],
    secciones: [
      {
        titulo: '1. Instrucciones para Inscribirse',
        porQue: 'El Art. 55 hace obligatoria la inscripción en el RNPA para operar legalmente como responsable de tratamiento; sin ella, la empresa está en incumplimiento aunque el resto de sus documentos estén perfectos.',
        instruccion: 'Siga estos pasos para completar la inscripción en el RNPA.',
        placeholder: 'Paso 1: Ingrese al portal oficial de la APDP en www.apdp.cl\nPaso 2: Seleccione "Registro Nacional de Protección de Datos (RNPA)"\nPaso 3: Complete el formulario con los datos de la empresa\nPaso 4: Adjunte los documentos requeridos\nPaso 5: Envíe la solicitud y guarde el número de inscripción asignado',
        obligatorio: true,
      },
      {
        titulo: '2. Datos de la Inscripción Obtenida',
        porQue: 'Guardar el comprobante es la única forma de acreditar ante la APDP que la inscripción existe y está vigente.',
        instruccion: 'Una vez completada la inscripción, registre aquí los datos del certificado.',
        placeholder: 'Número de inscripción RNPA: [COMPLETAR] (ej: RNPA-2026-0001234)\nFecha de inscripción: [COMPLETAR] (ej: 10 de enero de 2026)\nFecha de vencimiento (si aplica): [COMPLETAR]\nRUT del responsable inscrito: [COMPLETAR] (ej: 76.123.456-7)\nNombre del responsable inscrito: [COMPLETAR] (ej: Comercializadora Andina SpA)',
        obligatorio: true,
      },
      {
        titulo: '3. Responsable de Mantener la Inscripción Vigente',
        porQue: 'Las inscripciones pueden requerir renovación o actualización; sin un responsable asignado, la empresa puede quedar inscrita con datos obsoletos sin darse cuenta.',
        instruccion: 'Designe a la persona responsable de renovar y actualizar la inscripción.',
        placeholder: 'Responsable de la inscripción RNPA: [COMPLETAR — nombre y cargo, ej: Andrea Muñoz — Encargada de Privacidad]\nCorreo electrónico: [COMPLETAR] (ej: contacto@suempresa.cl)\nFrecuencia de verificación de vigencia: [COMPLETAR — ej: semestral]\nFecha de próxima revisión: [COMPLETAR] (ej: 10 de julio de 2026)',
        obligatorio: true,
      },
    ],
  },

  // ─── Consentimiento Informado ─────────────────────────────────────────────
  consentimiento: {
    reqId: 'consentimiento',
    titulo: 'Formulario y Procedimiento de Obtención de Consentimiento Informado',
    articulo: 'Artículo 12 — Ley 21.719 de Protección de Datos Personales',
    proposito: 'Este documento establece el mecanismo formal de obtención del consentimiento libre, específico, informado e inequívoco de los titulares de datos, y el registro de evidencia de dicho consentimiento, según el Art. 12 de la Ley 21.719.',
    checklist: [
      '¿El texto de consentimiento es específico para cada finalidad (no uno genérico para todo)?',
      '¿El mecanismo de obtención queda registrado con fecha, hora y versión del texto?',
      '¿Existe un canal simple y sin fricción para retirar el consentimiento?',
      '¿El consentimiento no es condición obligatoria para un servicio que no lo requiere?',
    ],
    notas: [
      'El consentimiento debe ser libre: no puede ser condición para acceder a un servicio si no es necesario.',
      'Debe ser específico: un consentimiento para una finalidad no vale para otras.',
      'El titular puede retirar el consentimiento en cualquier momento sin consecuencias negativas.',
      'Guarde evidencia del consentimiento con fecha y medio de obtención.',
    ],
    secciones: [
      {
        titulo: '1. Texto del Consentimiento Informado',
        porQue: 'El Art. 12 exige que el consentimiento sea informado; un texto ambiguo o técnico invalida el consentimiento obtenido, sea cual sea la finalidad.',
        instruccion: 'Redacte el texto que el titular leerá y aceptará. Debe ser claro y sin tecnicismos.',
        placeholder: 'Al aceptar, usted autoriza a [COMPLETAR — nombre empresa], RUT [COMPLETAR], con domicilio en [COMPLETAR], a tratar sus datos personales con la siguiente finalidad:\n\nFinalidad: [COMPLETAR — ej: envío de comunicaciones comerciales, gestión de su cuenta]\n\nDatos que se tratarán: [COMPLETAR — ej: nombre, correo electrónico, RUT]\n\nBase legal: Su consentimiento expreso (Art. 12, Ley 21.719).\n\nSus derechos: Puede acceder, rectificar, cancelar u oponerse al tratamiento escribiendo a [COMPLETAR — correo ARCO].\n\nPlazo de conservación: [COMPLETAR — ej: mientras mantenga su cuenta activa o hasta que retire su consentimiento].\n\nPuede retirar su consentimiento en cualquier momento sin consecuencias negativas enviando un correo a [COMPLETAR].',
        obligatorio: true,
      },
      {
        titulo: '2. Mecanismo de Obtención del Consentimiento',
        porQue: 'Sin un mecanismo verificable (checkbox, firma, log), la empresa no puede demostrar que el titular efectivamente consintió, lo que equivale a no tener consentimiento.',
        instruccion: 'Describa cómo y dónde se obtiene el consentimiento (checkbox, firma, etc.).',
        placeholder: 'Medio de obtención: [COMPLETAR — ej: checkbox en formulario web / firma en papel / confirmación por correo]\nURL o ubicación del formulario: [COMPLETAR]\nRegistro generado al aceptar: [COMPLETAR — ej: log con IP, fecha y hora, versión del texto aceptado]',
        obligatorio: true,
      },
      {
        titulo: '3. Procedimiento de Retiro del Consentimiento',
        porQue: 'El titular puede retirar su consentimiento en cualquier momento; si no existe un canal simple para hacerlo, el tratamiento posterior es ilícito.',
        instruccion: 'Defina cómo un titular puede retirar su consentimiento de forma sencilla.',
        placeholder: 'Canal para retirar el consentimiento: [COMPLETAR — ej: correo a privacidad@empresa.cl o formulario en www.empresa.cl/privacidad]\nPlazo máximo de procesamiento: [COMPLETAR — ej: 5 días hábiles]\nAcción resultante: [COMPLETAR — ej: eliminación del dato o cese del tratamiento específico]\nConfirmación al titular: [COMPLETAR — ej: correo de confirmación con acuse de recibo]',
        obligatorio: true,
      },
      {
        titulo: '4. Registro de Consentimientos',
        porQue: 'Sin evidencia con fecha y versión del texto aceptado, la empresa no puede probar ante una fiscalización que el consentimiento fue válido en el momento en que se obtuvo.',
        instruccion: 'Indique cómo se almacena la evidencia del consentimiento.',
        placeholder: 'Sistema de registro: [COMPLETAR — ej: base de datos CRM, planilla cifrada]\nCampos registrados: [COMPLETAR — ej: RUT, correo, fecha, hora, versión del texto, medio]\nResponsable del registro: [COMPLETAR — ej: Andrea Muñoz — Encargada de Privacidad]\nPlazo de conservación del registro: [COMPLETAR — ej: durante toda la relación y 5 años adicionales]',
        obligatorio: true,
      },
    ],
  },

  // ─── Designación del DPO ──────────────────────────────────────────────────
  designacion_dpo: {
    reqId: 'designacion_dpo',
    titulo: 'Acta de Designación del Delegado de Protección de Datos (DPO)',
    articulo: 'Artículo 49 — Ley 21.719 de Protección de Datos Personales',
    proposito: 'Este documento formaliza la designación del Delegado de Protección de Datos (DPO) de la empresa, establece sus funciones, garantiza su independencia y acredita la comunicación de la designación a la APDP, conforme al Art. 49 de la Ley 21.719.',
    checklist: [
      '¿El DPO cuenta con conocimientos especializados en protección de datos (formación o experiencia acreditable)?',
      '¿Se comunicó formalmente la designación a la APDP?',
      '¿El DPO tiene garantías explícitas de independencia (no recibe instrucciones sobre sus funciones)?',
      '¿La designación está firmada por el representante legal?',
    ],
    notas: [
      'El DPO debe tener conocimientos especializados en derecho y prácticas de protección de datos.',
      'Debe gozar de independencia funcional: no puede recibir instrucciones respecto del ejercicio de sus funciones.',
      'La designación debe comunicarse a la APDP dentro del plazo legal.',
      'El DPO puede ser interno (empleado) o externo (proveedor de servicios).',
    ],
    secciones: [
      {
        titulo: '1. Datos del DPO Designado',
        porQue: 'El Art. 49 exige que el DPO sea identificable y contactable; sin sus datos formalizados, ni la APDP ni los titulares pueden dirigirse a él.',
        instruccion: 'Complete los datos de identificación y contacto del Delegado de Protección de Datos.',
        placeholder: 'Nombre completo: [COMPLETAR] (ej: Andrea Muñoz Silva)\nRUT: [COMPLETAR] (ej: 15.678.234-5)\nCargo dentro de la empresa (si es interno): [COMPLETAR] (ej: Jefa de Cumplimiento Normativo)\nCorreo electrónico de contacto DPO: [COMPLETAR] (ej: dpo@suempresa.cl)\nTeléfono de contacto: [COMPLETAR] (ej: +56 2 2345 6789)\nTipo de designación: [COMPLETAR — Interno / Externo]\nSi es externo — nombre de la empresa prestadora: [COMPLETAR]',
        obligatorio: true,
      },
      {
        titulo: '2. Funciones y Responsabilidades del DPO',
        porQue: 'Sin funciones explícitas, el DPO puede quedar reducido a un cargo nominal sin ejercer control real sobre el cumplimiento de la ley.',
        instruccion: 'Detalle las funciones asignadas al DPO dentro de la organización.',
        placeholder: 'El DPO tendrá las siguientes responsabilidades:\n1. Informar y asesorar al responsable y a los empleados sobre las obligaciones de la Ley 21.719.\n2. Supervisar el cumplimiento de la política de protección de datos.\n3. Asesorar en la realización de Evaluaciones de Impacto (EIPD).\n4. Actuar como punto de contacto con la APDP.\n5. Atender consultas de los titulares de datos sobre el ejercicio de sus derechos.\n6. [COMPLETAR — funciones adicionales específicas de la empresa]',
        obligatorio: true,
      },
      {
        titulo: '3. Independencia y Recursos Asignados',
        porQue: 'El Art. 49 exige que el DPO actúe sin instrucciones sobre sus funciones; sin esta garantía formal, la empresa puede presionarlo y anular su rol protector.',
        instruccion: 'Declare las garantías de independencia y los recursos asignados al DPO.',
        placeholder: 'Garantías de independencia:\n• El DPO no recibirá instrucciones respecto del ejercicio de sus funciones de protección de datos.\n• No será sancionado ni destituido por el ejercicio de sus funciones.\n• Reportará directamente al nivel directivo superior de la organización.\n\nRecursos asignados:\n• Acceso a: [COMPLETAR — ej: todos los sistemas de tratamiento de datos, documentación interna]\n• Tiempo dedicado: [COMPLETAR — ej: 50% de jornada / tiempo completo]\n• Presupuesto para formación continua: [COMPLETAR]',
        obligatorio: true,
      },
      {
        titulo: '4. Notificación a la APDP',
        porQue: 'La designación del DPO debe comunicarse formalmente a la APDP; sin evidencia de esa comunicación, la empresa no puede acreditar que cumplió esta obligación.',
        instruccion: 'Registre los datos de la comunicación formal de la designación a la APDP.',
        placeholder: 'Fecha de notificación a la APDP: [COMPLETAR] (ej: 20 de enero de 2026)\nMedio de notificación: [COMPLETAR — ej: formulario portal APDP / correo oficial]\nNúmero de referencia o acuse de recibo: [COMPLETAR] (ej: APDP-REF-2026-00456)\nFecha de acuse de recibo de la APDP: [COMPLETAR]',
        obligatorio: true,
      },
      {
        titulo: '5. Aprobación de la Designación',
        porQue: 'Sin la firma del representante legal, la designación no tiene validez jurídica dentro de la organización.',
        instruccion: 'La designación debe ser firmada por el representante legal de la empresa.',
        placeholder: 'En [COMPLETAR — ciudad, ej: Santiago], a [COMPLETAR — fecha, ej: 15 de enero de 2026], el representante legal de [COMPLETAR — nombre empresa], RUT [COMPLETAR], designa formalmente a [COMPLETAR — nombre DPO] como Delegado de Protección de Datos.\n\nFirma representante legal: _______________________\nNombre: [COMPLETAR] (ej: Juan Pérez Soto)\nRUT: [COMPLETAR] (ej: 76.123.456-7)\nFecha: [COMPLETAR]',
        obligatorio: true,
      },
    ],
  },

};
