/**
 * HTML/CSS Report Template Generator for `react-native-html-to-pdf` (RF-06).
 * Produces an engineering-grade Installation & Network Diagnostics Report with
 * georeferenced photo evidence, SNMP MIB-II telemetry, and SSH execution logs.
 */

import type { InstallationReport } from '../models.js';

export function buildInstallationReportHtml(report: InstallationReport): string {
  const createdDate = new Date(report.createdAt).toLocaleString('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  const snmpSection = report.snmpSnapshot
    ? `
      <div class="section">
        <h2>3. Telemetría SNMP v2c (MIB-II - UDP/161)</h2>
        <table>
          <tr><th>OID / Métrica</th><th>Valor Relevado</th></tr>
          <tr><td>sysName (1.3.6.1.2.1.1.5.0)</td><td>${escapeHtml(report.snmpSnapshot.sysName)}</td></tr>
          <tr><td>sysDescr (1.3.6.1.2.1.1.1.0)</td><td>${escapeHtml(report.snmpSnapshot.sysDescr)}</td></tr>
          <tr><td>sysUpTime (1.3.6.1.2.1.1.3.0)</td><td>${escapeHtml(report.snmpSnapshot.sysUpTimeFormatted)} (${report.snmpSnapshot.sysUpTimeTicks} ticks)</td></tr>
          <tr><td>sysLocation (1.3.6.1.2.1.1.6.0)</td><td>${escapeHtml(report.snmpSnapshot.sysLocation)}</td></tr>
          <tr><td>Interfaz Principal (ifDescr.1)</td><td>${escapeHtml(report.snmpSnapshot.interfaces[0]?.ifDescr ?? 'eth0')} [${escapeHtml(report.snmpSnapshot.interfaces[0]?.ifOperStatus ?? 'UP')}]</td></tr>
          <tr><td>Tráfico RX / TX (ifInOctets / ifOutOctets)</td><td>RX: ${(report.snmpSnapshot.interfaces[0]?.ifInOctets ?? 0).toLocaleString('es-AR')} B | TX: ${(report.snmpSnapshot.interfaces[0]?.ifOutOctets ?? 0).toLocaleString('es-AR')} B</td></tr>
          <tr><td>Trama PDU Response (BER Hex)</td><td class="mono">${escapeHtml(report.snmpSnapshot.rawResponseHex.slice(0, 96))}...</td></tr>
        </table>
      </div>
    `
    : '';

  const sshSection = report.sshResult
    ? `
      <div class="section">
        <h2>4. Diagnóstico Remoto vía SSH (TCP/22)</h2>
        <p><strong>Comando ejecutado:</strong> <span class="mono">${escapeHtml(report.sshResult.command)}</span> (Credencial Keychain: <span class="mono">${escapeHtml(report.sshResult.credentialKeychainRef)}</span>)</p>
        <pre>${escapeHtml(report.sshResult.stdout)}</pre>
      </div>
    `
    : '';

  const photosSection =
    report.photos.length > 0
      ? report.photos
          .map(
            (photo, idx) => `
          <div class="photo-card">
            <div class="photo-meta">
              <strong>Evidencia Fotográfica #${idx + 1}:</strong> ${escapeHtml(photo.caption)}<br/>
              <span>GPS Foto: ${photo.coordinates.latitude.toFixed(6)}, ${photo.coordinates.longitude.toFixed(6)} (±${photo.coordinates.accuracyMeters}m) — ${new Date(photo.capturedAt).toLocaleTimeString('es-AR')}</span>
            </div>
            ${
              photo.base64Preview
                ? `<img src="${photo.base64Preview}" alt="Evidencia ${idx + 1}" class="photo-img" />`
                : `<div class="photo-uri">Archivo local: ${escapeHtml(photo.uri)}</div>`
            }
          </div>
        `
          )
          .join('')
      : '<p>Sin fotografías adjuntas.</p>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Reporte Técnico de Instalación — ${escapeHtml(report.id)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      margin: 24px;
      font-size: 12px;
      line-height: 1.5;
    }
    .header {
      border-bottom: 2px solid #0284C7;
      padding-bottom: 12px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    h1 {
      font-size: 18px;
      margin: 0 0 4px 0;
      color: #0F172A;
    }
    h2 {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0284C7;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 4px;
      margin-top: 16px;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      background: #E0F2FE;
      color: #0369A1;
      border-radius: 4px;
      font-weight: 700;
      font-size: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    th, td {
      border: 1px solid #CBD5E1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #F8FAFC;
      font-weight: 700;
      width: 34%;
    }
    .mono {
      font-family: "Courier New", Courier, monospace;
      font-size: 11px;
    }
    pre {
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      padding: 8px;
      font-family: "Courier New", Courier, monospace;
      font-size: 10px;
      white-space: pre-wrap;
    }
    .photo-card {
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 10px;
      margin-top: 8px;
      background: #F8FAFC;
    }
    .photo-img {
      max-width: 280px;
      max-height: 180px;
      margin-top: 6px;
      border: 1px solid #94A3B8;
      border-radius: 4px;
    }
    .footer {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #E2E8F0;
      font-size: 10px;
      color: #64748B;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>REPORTE TÉCNICO DE INSTALACIÓN Y DIAGNÓSTICO DE RED</h1>
      <div>Network Diagnostics Suite — FCyT UADER — ID: <span class="mono">${escapeHtml(report.id)}</span></div>
      <div>Fecha de Relevamiento: ${escapeHtml(createdDate)} | Técnico: <strong>${escapeHtml(report.technicianName)}</strong></div>
    </div>
    <div class="badge">OFFLINE-FIRST CERTIFICADO</div>
  </div>

  <div class="section">
    <h2>1. Identificación del Equipo y Sitio (RF-01 / RF-04)</h2>
    <table>
      <tr><th>Sitio / Nodo de Instalación</th><td>${escapeHtml(report.siteName)}</td></tr>
      <tr><th>Fabricante y Modelo</th><td>${escapeHtml(report.vendor)} — ${escapeHtml(report.model)}</td></tr>
      <tr><th>Código QR / Serie Escaneado</th><td class="mono">${escapeHtml(report.qrBarcode)}</td></tr>
      <tr><th>Dirección IPv4 / Hostname</th><td class="mono">${escapeHtml(report.deviceIp)} (${escapeHtml(report.deviceHostname)})</td></tr>
      <tr><th>Dirección Física MAC</th><td class="mono">${escapeHtml(report.deviceMac)}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>2. Georreferenciación GPS y Notas de Campo (RF-05)</h2>
    <table>
      <tr><th>Coordenadas GPS (WGS84)</th><td class="mono">Lat: ${report.coordinates.latitude.toFixed(6)}, Lon: ${report.coordinates.longitude.toFixed(6)}</td></tr>
      <tr><th>Precisión Horizontal / Altitud</th><td>±${report.coordinates.accuracyMeters} metros ${report.coordinates.altitudeMeters ? `| Altitud: ${report.coordinates.altitudeMeters} msnm` : ''}</td></tr>
      <tr><th>Observaciones Técnicas del Instalador</th><td>${escapeHtml(report.technicianNotes)}</td></tr>
    </table>
  </div>

  ${snmpSection}
  ${sshSection}

  <div class="section">
    <h2>5. Evidencia Fotográfica Georreferenciada (RF-05 / RF-06)</h2>
    ${photosSection}
  </div>

  <div class="footer">
    Documento generado localmente por Network Diagnostics Suite (WatermelonDB + Outbox Pattern). Estado de Sincronización: ${escapeHtml(report.syncStatus)}.
  </div>
</body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

