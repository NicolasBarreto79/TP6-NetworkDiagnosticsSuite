import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import type {
  DeviceDatasheet,
  EvidencePhoto,
  GeoCoordinates,
  InstallationReport,
  NetworkDevice,
  SnmpTelemetrySnapshot,
  SshExecutionResult,
} from '@network-suite/contracts';
import {
  captureGeoreferencedPhoto,
  captureGpsLocation,
  scanEquipmentQrCode,
} from '../layers/evidence/evidenceLayer';
import { registerInstallationAndGeneratePdf } from '../layers/reporting/reportingLayer';

interface InstallationReportScreenProps {
  devices: NetworkDevice[];
  selectedDevice: NetworkDevice;
  onSelectDevice: (device: NetworkDevice) => void;
  latestSnmp: SnmpTelemetrySnapshot | null;
  latestSsh: SshExecutionResult | null;
}

const SAMPLE_QR_CODES = [
  { code: 'QR-MK-CCR2004-SN884120', label: 'MikroTik CCR2004 (Router)' },
  { code: 'QR-HW-HG8245Q2-SN485754', label: 'Huawei HG8245Q2 (ONT GPON)' },
  { code: 'QR-UBNT-PBE5AC-SN788A20', label: 'Ubiquiti PowerBeam 5AC (Antena)' },
  { code: 'QR-CISCO-2960X-SNFOC2140', label: 'Cisco Catalyst 2960-X (Switch)' },
];

export function InstallationReportScreen({
  devices,
  selectedDevice,
  onSelectDevice,
  latestSnmp,
  latestSsh,
}: InstallationReportScreenProps) {
  const [qrInput, setQrInput] = useState(
    selectedDevice.qrBarcode ?? 'QR-MK-CCR2004-SN884120'
  );
  const [scannedDatasheet, setScannedDatasheet] = useState<DeviceDatasheet | null>(null);
  const [datasheetSource, setDatasheetSource] = useState<string>('');
  const [siteName, setSiteName] = useState(selectedDevice.siteName);
  const [technicianName, setTechnicianName] = useState('Nicolás Barreto');
  const [technicianNotes, setTechnicianNotes] = useState(
    'Equipo instalado en gabinete estanco, patchcord FO LC/APC certificado, nivel óptico y latencia SNMP verificados en campo.'
  );
  const [photoCaption, setPhotoCaption] = useState(
    'Frente de rack, acometida de fibra óptica y puesta a tierra'
  );
  const [gpsCoords, setGpsCoords] = useState<GeoCoordinates>({
    latitude: -32.484512,
    longitude: -58.232104,
    accuracyMeters: 3.2,
    altitudeMeters: 28.5,
    capturedAt: Date.now(),
  });
  const [photos, setPhotos] = useState<EvidencePhoto[]>([]);
  const [generatedReport, setGeneratedReport] = useState<InstallationReport | null>(null);
  const [gpsPresetIndex, setGpsPresetIndex] = useState(0);

  const handleScanQr = async (codeToScan?: string) => {
    const code = codeToScan ?? qrInput;
    setQrInput(code);
    const result = await scanEquipmentQrCode(code);
    setScannedDatasheet(result.datasheet);
    setDatasheetSource(
      result.source === 'REMOTE_BACKEND'
        ? 'API Remota de Fichas Técnicas'
        : 'Caché Local Offline (WatermelonDB)'
    );
    const matchingDev = devices.find(
      (d) => d.qrBarcode === result.datasheet.qrCode || d.ipAddress === result.datasheet.defaultIp
    );
    if (matchingDev) {
      onSelectDevice(matchingDev);
      setSiteName(matchingDev.siteName);
    }
  };

  const handleCaptureGps = async () => {
    const nextIdx = gpsPresetIndex + 1;
    setGpsPresetIndex(nextIdx);
    const coords = await captureGpsLocation(nextIdx);
    setGpsCoords(coords);
  };

  const handleCapturePhoto = () => {
    const photo = captureGeoreferencedPhoto({
      reportId: 'DRAFT',
      deviceHostname: selectedDevice.hostname,
      deviceIp: selectedDevice.ipAddress,
      caption: photoCaption,
      coordinates: gpsCoords,
    });
    setPhotos((prev) => [photo, ...prev]);
  };

  const handleGenerateReportAndQueue = () => {
    const activePhotos =
      photos.length > 0
        ? photos
        : [
            captureGeoreferencedPhoto({
              reportId: 'AUTO',
              deviceHostname: selectedDevice.hostname,
              deviceIp: selectedDevice.ipAddress,
              caption: photoCaption,
              coordinates: gpsCoords,
            }),
          ];

    if (photos.length === 0) {
      setPhotos(activePhotos);
    }

    const bundle = registerInstallationAndGeneratePdf({
      device: selectedDevice,
      qrBarcode: qrInput,
      siteName,
      technicianName,
      technicianNotes,
      coordinates: gpsCoords,
      photos: activePhotos,
      snmpSnapshot: latestSnmp ?? undefined,
      sshResult: latestSsh ?? undefined,
    });

    setGeneratedReport(bundle.report);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Paso 1: Escáner QR / Código de Barras (RF-04) */}
      <View style={styles.card}>
        <Text style={styles.sectionTag}>
          CAPA 03 — EVIDENCE LAYER (RF-04 QR/BARCODE SCANNER)
        </Text>
        <Text style={styles.title}>
          1. Identificación de Equipo vía Código QR / Barras
        </Text>
        <Text style={styles.subtitle}>
          Escanee la etiqueta del equipo con VisionCamera para vincular su número de serie con la ficha técnica homologada (opera online y offline).
        </Text>

        <View style={styles.qrButtonsRow}>
          {SAMPLE_QR_CODES.map((item) => (
            <TouchableOpacity
              key={item.code}
              style={[
                styles.qrChip,
                qrInput === item.code && styles.qrChipActive,
              ]}
              onPress={() => handleScanQr(item.code)}
              testID={`btn-qr-${item.code}`}
            >
              <Text
                style={[
                  styles.qrChipText,
                  qrInput === item.code && styles.qrChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.controlsRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={qrInput}
            onChangeText={setQrInput}
            placeholder="Código QR o Número de Serie"
          />
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => handleScanQr()}
            testID="btn-scan-qr"
          >
            <Text style={styles.primaryButtonText}>ESCANEAR CÓDIGO QR</Text>
          </TouchableOpacity>
        </View>

        {scannedDatasheet && (
          <View style={styles.datasheetBox}>
            <View style={styles.datasheetHeader}>
              <Text style={styles.datasheetTitle}>
                FICHA TÉCNICA VINCULADA: {scannedDatasheet.vendor} — {scannedDatasheet.model}
              </Text>
              <Text style={styles.datasheetSourceBadge}>Origen: {datasheetSource}</Text>
            </View>
            <Text style={styles.datasheetMeta}>
              S/N: {scannedDatasheet.serialNumber} | IP Gestión: {scannedDatasheet.defaultIp} | Puertos: {scannedDatasheet.portsDescription}
            </Text>
            <Text style={styles.datasheetMeta}>
              Rango Óptico/RF: {scannedDatasheet.opticalRxRangeDbm ?? 'Ethernet Cobre/SFP'} | Consumo: {scannedDatasheet.powerConsumptionWatts}W | Firmware: {scannedDatasheet.firmwareRecommended}
            </Text>
            <View style={styles.checklistBox}>
              {scannedDatasheet.installationChecklist.map((step, i) => (
                <Text key={i} style={styles.checklistItem}>
                  • {step}
                </Text>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Paso 2: Evidencia Fotográfica + Ubicación GPS (RF-05) */}
      <View style={styles.card}>
        <Text style={styles.sectionTag}>
          CAPA 03 & CAPA 06 — EVIDENCE & REPORTING LAYER (RF-05 «include» RF-06 «include» RF-07)
        </Text>
        <Text style={styles.title}>
          2. Registro de Instalación, Fotos Georreferenciadas y Reporte PDF
        </Text>

        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.inputLabel}>Sitio / Nodo de Instalación</Text>
            <TextInput
              style={styles.input}
              value={siteName}
              onChangeText={setSiteName}
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.inputLabel}>Técnico Responsable</Text>
            <TextInput
              style={styles.input}
              value={technicianName}
              onChangeText={setTechnicianName}
            />
          </View>
        </View>

        <View style={styles.gpsBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.gpsTitle}>
              COORDENADAS GPS GEORREFERENCIADAS (WGS84)
            </Text>
            <Text style={styles.gpsCoordsText}>
              Latitud: {gpsCoords.latitude.toFixed(6)} | Longitud: {gpsCoords.longitude.toFixed(6)} | Precisión: ±{gpsCoords.accuracyMeters}m | Altitud: {gpsCoords.altitudeMeters ?? 28} msnm
            </Text>
          </View>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleCaptureGps}
            testID="btn-refresh-gps"
          >
            <Text style={styles.secondaryButtonText}>ACTUALIZAR GPS</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.photoCaptureRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Epígrafe de Fotografía de Evidencia</Text>
            <TextInput
              style={styles.input}
              value={photoCaption}
              onChangeText={setPhotoCaption}
            />
          </View>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleCapturePhoto}
            testID="btn-capture-photo"
          >
            <Text style={styles.secondaryButtonText}>
              CAPTURAR FOTO ({photos.length})
            </Text>
          </TouchableOpacity>
        </View>

        {photos.length > 0 && (
          <View style={styles.photoList}>
            {photos.map((p, idx) => (
              <View key={p.id} style={styles.photoBadge}>
                <Text style={styles.photoBadgeTitle}>
                  Foto #{idx + 1}: {p.caption}
                </Text>
                <Text style={styles.photoBadgeSub}>
                  URI: {p.uri} | GPS: {p.coordinates.latitude.toFixed(5)}, {p.coordinates.longitude.toFixed(5)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ marginTop: 10 }}>
          <Text style={styles.inputLabel}>Notas Técnicas de Instalación</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={technicianNotes}
            onChangeText={setTechnicianNotes}
            multiline
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, { marginTop: 14, paddingVertical: 13 }]}
          onPress={handleGenerateReportAndQueue}
          testID="btn-generate-pdf"
        >
          <Text style={styles.primaryButtonText}>
            REGISTRAR INSTALACIÓN, GENERAR PDF OFFLINE Y ENCOLAR EN OUTBOX
          </Text>
        </TouchableOpacity>

        {generatedReport && (
          <View style={styles.pdfSuccessCard}>
            <View style={styles.pdfHeaderRow}>
              <Text style={styles.pdfBadge}>REPORTE PDF GENERADO Y ENCOLADO (RF-06 / RF-07)</Text>
              <Text style={styles.pdfIdText}>ID: {generatedReport.id}</Text>
            </View>
            <Text style={styles.pdfFileText}>
              Archivo: {generatedReport.pdfFileName} ({(generatedReport.pdfSizeBytes / 1024).toFixed(1)} KB)
            </Text>
            <Text style={styles.pdfUriText}>Ruta Local: {generatedReport.pdfLocalUri}</Text>
            <Text style={styles.pdfMetaText}>
              Equipo: {generatedReport.deviceHostname} ({generatedReport.deviceIp}) | QR: {generatedReport.qrBarcode} | Fotos: {generatedReport.photos.length} | GPS: {generatedReport.coordinates.latitude.toFixed(5)}, {generatedReport.coordinates.longitude.toFixed(5)}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  sectionTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  qrButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  qrChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  qrChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  qrChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  qrChipTextActive: {
    color: '#FFFFFF',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 68,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 12,
  },
  datasheetBox: {
    marginTop: 12,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    padding: 12,
  },
  datasheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  datasheetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
  datasheetSourceBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  datasheetMeta: {
    fontSize: 12,
    color: '#0F172A',
    marginBottom: 3,
  },
  checklistBox: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#BAE6FD',
  },
  checklistItem: {
    fontSize: 11,
    color: '#334155',
    marginBottom: 2,
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  formField: {
    flex: 1,
    minWidth: 200,
  },
  gpsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 10,
  },
  gpsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
    marginBottom: 2,
  },
  gpsCoordsText: {
    fontSize: 12,
    color: '#0F172A',
    fontFamily: 'monospace',
  },
  photoCaptureRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  photoList: {
    marginTop: 10,
    gap: 6,
  },
  photoBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    padding: 8,
  },
  photoBadgeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  photoBadgeSub: {
    fontSize: 11,
    color: '#475569',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  pdfSuccessCard: {
    marginTop: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 8,
    padding: 12,
  },
  pdfHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pdfBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  pdfIdText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: 'monospace',
  },
  pdfFileText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  pdfUriText: {
    fontSize: 11,
    color: '#334155',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  pdfMetaText: {
    fontSize: 11,
    color: '#047857',
    marginTop: 4,
  },
});

