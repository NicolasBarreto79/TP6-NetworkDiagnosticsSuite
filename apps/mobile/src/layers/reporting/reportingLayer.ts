/**
 * Layer 6: Reporting Layer (Offline Installation Report PDF Generation — RF-05, RF-06).
 *
 * Implements the Use Case Diagram (Figure 2) «include» chain:
 *  1. "Registrar instalación (fotos + GPS + notas)" «include» "Generar reporte de instalación en PDF"
 *  2. "Generar reporte de instalación en PDF" «include» "Encolar acciones pendientes (outbox)"
 */

import {
  buildInstallationReportHtml,
  createOutboxQueueItem,
  type EvidencePhoto,
  type GeoCoordinates,
  type InstallationReport,
  type NetworkDevice,
  type OutboxQueueItem,
  type SnmpTelemetrySnapshot,
  type SshExecutionResult,
} from '@network-suite/contracts';
import { localStore } from '../store/localStore';

export interface GeneratedReportBundle {
  report: InstallationReport;
  htmlContent: string;
  outboxItem: OutboxQueueItem;
}

/**
 * RF-05 + «include» RF-06 + «include» RF-07:
 * Registers a field installation, compiles the PDF document locally offline (`react-native-html-to-pdf`),
 * persists the report in WatermelonDB (`localStore`), and immediately enqueues it in the Outbox.
 */
export function registerInstallationAndGeneratePdf(params: {
  device: NetworkDevice;
  qrBarcode: string;
  siteName: string;
  technicianName: string;
  technicianNotes: string;
  coordinates: GeoCoordinates;
  photos: EvidencePhoto[];
  snmpSnapshot?: SnmpTelemetrySnapshot;
  sshResult?: SshExecutionResult;
}): GeneratedReportBundle {
  const now = Date.now();
  const reportId = `REP-${new Date(now).getFullYear()}-${String(now).slice(-5)}`;
  const pdfFileName = `${reportId}_${params.device.hostname}.pdf`;
  const pdfLocalUri = `file:///storage/emulated/0/Documents/NetworkDiagnosticsSuite/${pdfFileName}`;

  const draftReport: InstallationReport = {
    id: reportId,
    deviceId: params.device.id,
    deviceIp: params.device.ipAddress,
    deviceMac: params.device.macAddress,
    deviceHostname: params.device.hostname,
    vendor: params.device.vendor,
    model: params.device.model,
    qrBarcode: params.qrBarcode || params.device.qrBarcode || 'QR-UNASSIGNED',
    siteName: params.siteName || params.device.siteName,
    technicianName: params.technicianName.trim() || 'Técnico de Campo',
    technicianNotes: params.technicianNotes.trim(),
    coordinates: params.coordinates,
    photos: params.photos.map((p) => ({ ...p, reportId })),
    snmpSnapshot: params.snmpSnapshot,
    sshResult: params.sshResult,
    pdfLocalUri,
    pdfFileName,
    pdfSizeBytes: 0,
    createdAt: now,
    syncStatus: 'PENDING_SYNC',
  };

  // Generate the complete HTML/PDF payload via `@network-suite/contracts`
  const htmlContent = buildInstallationReportHtml(draftReport);
  const computedByteSize = new TextEncoder().encode(htmlContent).length;

  const finalizedReport: InstallationReport = {
    ...draftReport,
    pdfSizeBytes: computedByteSize,
  };

  // 1. Persist report in WatermelonDB local store (100% offline-first)
  localStore.addInstallationReport(finalizedReport);

  // 2. «include» Enqueue pending action in Outbox Queue (RF-07)
  const outboxItem = createOutboxQueueItem({
    entityType: 'INSTALLATION_REPORT',
    entityId: finalizedReport.id,
    operation: 'CREATE',
    payload: finalizedReport,
    now,
  });
  localStore.upsertOutboxItem(outboxItem);

  return {
    report: finalizedReport,
    htmlContent,
    outboxItem,
  };
}

