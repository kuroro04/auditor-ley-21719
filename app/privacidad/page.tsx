import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Aviso de Privacidad — DataShield',
  description: 'Información sobre el tratamiento de datos personales en la plataforma DataShield',
};

export default function PrivacidadPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: 'var(--font-sora, Sora, sans-serif)',
    }}>
      {/* Cabecera */}
      <header style={{
        background: 'var(--navy)',
        padding: '20px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        <Link href="/" style={{
          color: 'rgba(255,255,255,0.6)',
          textDecoration: 'none',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
          Volver a DataShield
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>|</span>
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', fontWeight: 600 }}>
          Aviso de Privacidad
        </span>
      </header>

      {/* Contenido principal */}
      <main style={{
        maxWidth: '760px',
        margin: '0 auto',
        padding: '48px 24px 80px',
      }}>
        <h1 style={{
          fontSize: '26px',
          fontWeight: 700,
          color: 'var(--navy)',
          marginBottom: '8px',
        }}>
          Aviso de Privacidad
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '40px' }}>
          Última actualización: octubre de 2026
        </p>

        <Section title="1. Responsable del tratamiento">
          <p>
            <strong>DataShield</strong> (en adelante, &ldquo;la plataforma&rdquo;) es la responsable del
            tratamiento de los datos personales que usted ingrese al utilizar el servicio de diagnóstico
            de cumplimiento de la Ley 21.719 de Protección de Datos Personales de Chile.
          </p>
          <p>Para consultas o ejercicio de derechos: <a href="mailto:privacidad@datashield.cl">privacidad@datashield.cl</a></p>
        </Section>

        <Section title="2. Datos que recopilamos">
          <p>La plataforma recopila y trata los siguientes datos:</p>
          <Table rows={[
            ['Categoría', 'Dato específico', 'Momento de recopilación'],
            ['Identificación del representante', 'Correo electrónico', 'Registro de cuenta'],
            ['Identificación de empresa', 'RUT de empresa, nombre, sector', 'Registro de cuenta'],
            ['Documentos de cumplimiento', 'Contenido textual extraído de los documentos subidos (PDF, Word, Excel)', 'Carga de documentos'],
            ['Registro de actividad', 'IP de origen, fecha/hora, tipo de acción', 'Cada acción en la plataforma (bitácora de auditoría)'],
          ]} />
          <p style={{ marginTop: '12px' }}>
            <strong>Documentos originales:</strong> los archivos que usted sube son procesados para extraer
            su texto. El texto extraído se utiliza para el análisis; los archivos originales se eliminan
            tras el procesamiento y no se almacenan de forma permanente.
          </p>
        </Section>

        <Section title="3. Finalidades del tratamiento">
          <p>Sus datos son tratados únicamente para:</p>
          <ol>
            <li>Proveer el servicio de diagnóstico de cumplimiento de la Ley 21.719.</li>
            <li>Autenticar su acceso a la plataforma y mantener la sesión.</li>
            <li>Generar y almacenar una bitácora de auditoría de las acciones realizadas, como medida de
              seguridad y trazabilidad exigida por regulaciones de seguridad de la información.</li>
            <li>Detectar y prevenir usos abusivos o no autorizados del servicio.</li>
          </ol>
          <p>
            <strong>No</strong> utilizamos sus datos para publicidad, perfiles de comportamiento,
            entrenamiento de modelos de inteligencia artificial ni los cedemos a terceros con fines comerciales.
          </p>
        </Section>

        <Section title="4. Base legal">
          <p>
            El tratamiento se realiza con base en el consentimiento que usted otorga al registrarse y
            utilizar el servicio (artículo 13, letra a) de la Ley 21.719), y en el interés legítimo de la
            plataforma para mantener la seguridad e integridad del sistema (artículo 13, letra f).
          </p>
        </Section>

        <Section title="5. Almacenamiento y seguridad">
          <p>Sus datos se almacenan en servidores ubicados en Chile o en la Unión Europea,
            con las siguientes medidas de seguridad:</p>
          <ul>
            <li>Aislamiento multi-tenant: cada empresa solo accede a sus propios datos (Row-Level Security en PostgreSQL).</li>
            <li>Cifrado en tránsito (HTTPS/TLS 1.2+).</li>
            <li>Contraseñas almacenadas con hash bcrypt.</li>
            <li>El segundo factor de autenticación (TOTP) se almacena cifrado con Fernet AES-128.</li>
            <li>Escaneo antivirus de cada documento cargado (ClamAV).</li>
          </ul>
        </Section>

        <Section title="6. Plazo de conservación">
          <p>
            Sus datos se conservan durante el tiempo en que la cuenta esté activa y hasta <strong>2 años</strong>{' '}
            después de la última actividad o de la solicitud de eliminación, salvo que una obligación legal
            exija un plazo mayor (como la conservación de bitácoras de auditoría bajo normas de seguridad
            de la información).
          </p>
          <p>
            La bitácora de auditoría se conserva por <strong>5 años</strong> para cumplir con requisitos
            de trazabilidad.
          </p>
        </Section>

        <Section title="7. Sus derechos (ARCOP)">
          <p>Como titular de datos personales bajo la Ley 21.719, usted tiene derecho a:</p>
          <Table rows={[
            ['Derecho', 'Descripción'],
            ['Acceso', 'Conocer qué datos suyos tratamos y cómo'],
            ['Rectificación', 'Corregir datos inexactos o incompletos'],
            ['Cancelación / Eliminación', 'Solicitar la eliminación de sus datos cuando ya no sean necesarios'],
            ['Oposición', 'Oponerse al tratamiento en determinadas circunstancias'],
            ['Portabilidad', 'Recibir sus datos en formato estructurado y de uso común'],
          ]} />
          <p style={{ marginTop: '12px' }}>
            Para ejercer cualquiera de estos derechos, envíe una solicitud a{' '}
            <a href="mailto:privacidad@datashield.cl">privacidad@datashield.cl</a>{' '}
            indicando su nombre, correo registrado y el derecho que desea ejercer.
            Responderemos en un plazo máximo de <strong>30 días hábiles</strong>.
          </p>
          <p>
            También puede reclamar ante la <strong>Agencia de Protección de Datos Personales</strong> de
            Chile una vez que esta se encuentre en funciones.
          </p>
        </Section>

        <Section title="8. Cookies y datos de navegación">
          <p>
            La plataforma utiliza una única cookie de sesión (<code>access_token</code>), de tipo
            httpOnly y SameSite=Lax, que no es legible por JavaScript ni por terceros. No se utilizan
            cookies de rastreo, publicidad ni analítica de terceros.
          </p>
        </Section>

        <Section title="9. Cambios a este aviso">
          <p>
            Cualquier cambio material será notificado por correo electrónico con al menos{' '}
            <strong>15 días de antelación</strong>. La versión vigente siempre estará disponible en{' '}
            <a href="/privacidad">datashield.cl/privacidad</a>.
          </p>
        </Section>
      </main>

      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '24px 32px',
        textAlign: 'center',
        color: 'var(--text3)',
        fontSize: '12px',
      }}>
        © {new Date().getFullYear()} DataShield · <Link href="/privacidad" style={{ color: 'var(--text3)' }}>Privacidad</Link>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '36px' }}>
      <h2 style={{
        fontSize: '16px',
        fontWeight: 600,
        color: 'var(--navy)',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid var(--border)',
      }}>
        {title}
      </h2>
      <div style={{
        fontSize: '14px',
        lineHeight: '1.7',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        {children}
      </div>
    </section>
  );
}

function Table({ rows }: { rows: string[][] }) {
  const [header, ...body] = rows;
  return (
    <div style={{ overflowX: 'auto', marginTop: '8px' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '13px',
      }}>
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th key={i} style={{
                textAlign: 'left',
                padding: '8px 12px',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                fontWeight: 600,
                color: 'var(--navy)',
                whiteSpace: 'nowrap',
              }}>
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  verticalAlign: 'top',
                  color: 'var(--text)',
                }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
