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
  contrato_encargado: {
    'Objeto e instrucciones del tratamiento': {
      titulo: 'Objeto e Instrucciones Documentadas (Art. 25 N° 1)',
      fundamento: 'Exigido por el Artículo 25 de la Ley N° 21.719.',
      ejemplo: 'El Encargado tratará los datos personales únicamente por cuenta e instrucciones documentadas del Responsable, exclusivamente para la prestación del servicio acordado, prohibiéndose cualquier uso en beneficio propio.',
      consejo: 'Debe constar por escrito o formato digital auditable.',
    },
    'Obligación de confidencialidad y secreto': {
      titulo: 'Deber de Secreto y Confidencialidad (Art. 25 N° 2)',
      fundamento: 'Exigido por el Artículo 25 de la Ley N° 21.719.',
      ejemplo: 'El Encargado garantiza que todo el personal autorizado para tratar datos personales ha asumido un compromiso expreso de confidencialidad y secreto, el cual subsistirá incluso tras el término de sus funciones.',
      consejo: 'Establezca que la confidencialidad no prescribe tras el fin del contrato.',
    },
    'Medidas de seguridad técnicas y organizativas': {
      titulo: 'Seguridad Exigida al Proveedor (Art. 25 N° 3)',
      fundamento: 'Exigido por los Artículos 19 y 25 de la Ley N° 21.719.',
      ejemplo: 'El Encargado implementará y mantendrá medidas técnicas y organizativas adecuadas para garantizar un nivel de seguridad proporcional al riesgo, incluyendo cifrado, control de accesos basados en roles y copias de seguridad periódicas.',
      consejo: 'Habilite la facultad de auditar periódicamente las medidas del proveedor.',
    },
    'Régimen de subcontratación': {
      titulo: 'Autorización Previa de Subencargados (Art. 25 N° 4)',
      fundamento: 'Exigido por el Artículo 25 N° 4 de la Ley N° 21.719.',
      ejemplo: 'El Encargado no podrá subcontratar total ni parcialmente sus servicios sin la autorización previa y por escrito del Responsable. Cualquier subencargado autorizado quedará sujeto a las mismas obligaciones que este contrato.',
      consejo: 'La subcontratación sin autorización previa es causal de infracción grave.',
    },
    'Asistencia en respuesta a derechos ARCO': {
      titulo: 'Asistencia Operativa ante Titulares (Art. 25 N° 5)',
      fundamento: 'Exigido por el Artículo 25 N° 5 de la Ley N° 21.719.',
      ejemplo: 'El Encargado asistirá al Responsable, a través de medidas técnicas apropiadas, para dar cumplimiento a su obligación de responder a las solicitudes de ejercicio de derechos ARCOP dentro del plazo legal de 30 días.',
      consejo: 'Indique un plazo interno más corto (ej: 5 días hábiles) para que el encargado le entregue la información.',
    },
    'Devolución o destrucción de datos al término': {
      titulo: 'Destino Final de los Datos (Art. 25 N° 7)',
      fundamento: 'Exigido por el Artículo 25 N° 7 de la Ley N° 21.719.',
      ejemplo: 'A elección del Responsable, el Encargado suprimirá o devolverá todos los datos personales una vez finalizada la prestación de servicios, destruyendo todas las copias existentes en sus sistemas y certificándolo por escrito.',
      consejo: 'Exija un certificado formal de destrucción segura de respaldos.',
    },
  },
};

export function obtenerGuiaClausula(reqId: string, criterioName: string): ClausulaEjemplo | null {
  const reqGuia = GUIA_CLAUSULAS[reqId];
  if (!reqGuia) return null;
  return reqGuia[criterioName] || null;
}
