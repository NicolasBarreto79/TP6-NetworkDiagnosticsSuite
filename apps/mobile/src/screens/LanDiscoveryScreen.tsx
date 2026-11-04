import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import type { NetworkDevice } from '@network-suite/contracts';
import { scanLocalNetworkLan } from '../layers/discovery/discoveryLayer';

interface LanDiscoveryScreenProps {
  devices: NetworkDevice[];
  selectedDevice: NetworkDevice | null;
  onSelectDevice: (device: NetworkDevice) => void;
  onNavigateToDiagnostics: (device: NetworkDevice) => void;
  onNavigateToInstall: (device: NetworkDevice) => void;
}

export function LanDiscoveryScreen({
  devices,
  selectedDevice,
  onSelectDevice,
  onNavigateToDiagnostics,
  onNavigateToInstall,
}: LanDiscoveryScreenProps) {
  const [subnet, setSubnet] = useState('192.168.1.0/24');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanMeta, setLastScanMeta] = useState<{
    durationMs: number;
    probes: number;
  } | null>(null);

  const handleRunScan = async () => {
    setIsScanning(true);
    try {
      const result = await scanLocalNetworkLan(subnet);
      setLastScanMeta({
        durationMs: result.scanDurationMs,
        probes: result.snmpProbesExecuted,
      });
      if (result.discoveredDevices.length > 0 && !selectedDevice) {
        onSelectDevice(result.discoveredDevices[0]);
      }
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTag}>CAPA 01 — DISCOVERY LAYER (RF-01 «include» RF-02)</Text>
            <Text style={styles.title}>Descubrimiento de Equipos en Red Local (LAN)</Text>
            <Text style={styles.subtitle}>
              Escaneo híbrido mDNS/Bonjour (Zeroconf) + barrido de subred UDP/TCP con sonda automática SNMPv2c (MIB-II) para resolución de hostname, uptime y dirección física MAC.
            </Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Rango de Subred Objetivo (CIDR)</Text>
            <TextInput
              style={styles.input}
              value={subnet}
              onChangeText={setSubnet}
              placeholder="192.168.1.0/24"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isScanning && styles.buttonDisabled]}
            onPress={handleRunScan}
            disabled={isScanning}
            testID="btn-scan-lan"
          >
            {isScanning ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>ESCANEAR RED LOCAL (LAN)</Text>
            )}
          </TouchableOpacity>
        </View>

        {lastScanMeta && (
          <View style={styles.scanSummaryBanner}>
            <Text style={styles.scanSummaryText}>
              Escaneo completado en {lastScanMeta.durationMs} ms — {devices.length} equipos activos descubiertos — {lastScanMeta.probes} consultas SNMP iniciales («include») ejecutadas sobre UDP/161.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>
          DISPOSITIVOS ACTIVOS EN SUBRED ({devices.length})
        </Text>
        <Text style={styles.listHint}>
          Seleccione un equipo para ejecutar diagnóstico SNMP/SSH o registrar instalación
        </Text>
      </View>

      {devices.map((dev) => {
        const isSelected = selectedDevice?.id === dev.id;
        return (
          <View
            key={dev.id}
            style={[styles.deviceCard, isSelected && styles.deviceCardSelected]}
          >
            <View style={styles.deviceTopRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.badgeRow}>
                  <View style={styles.vendorBadge}>
                    <Text style={styles.vendorBadgeText}>{dev.vendor.toUpperCase()}</Text>
                  </View>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{dev.category}</Text>
                  </View>
                  <View style={styles.methodBadge}>
                    <Text style={styles.methodBadgeText}>{dev.discoveryMethod}</Text>
                  </View>
                </View>
                <Text style={styles.deviceHostname}>{dev.hostname}</Text>
                <Text style={styles.deviceModel}>
                  {dev.model} — {dev.siteName}
                </Text>
              </View>

              <View style={styles.ipBox}>
                <Text style={styles.ipText}>{dev.ipAddress}</Text>
                <Text style={styles.macText}>MAC: {dev.macAddress}</Text>
              </View>
            </View>

            <View style={styles.telemetryGrid}>
              <View style={styles.telemetryCell}>
                <Text style={styles.telemetryLabel}>SNMP sysUpTime</Text>
                <Text style={styles.telemetryValue}>
                  {dev.sysUpTimeFormatted ?? 'Pendiente de sonda'}
                </Text>
              </View>
              <View style={styles.telemetryCell}>
                <Text style={styles.telemetryLabel}>Tráfico RX (ifInOctets)</Text>
                <Text style={styles.telemetryValue}>
                  {dev.ifInOctets !== undefined
                    ? `${(dev.ifInOctets / (1024 * 1024)).toFixed(1)} MB`
                    : '--'}
                </Text>
              </View>
              <View style={styles.telemetryCell}>
                <Text style={styles.telemetryLabel}>Tráfico TX (ifOutOctets)</Text>
                <Text style={styles.telemetryValue}>
                  {dev.ifOutOctets !== undefined
                    ? `${(dev.ifOutOctets / (1024 * 1024)).toFixed(1)} MB`
                    : '--'}
                </Text>
              </View>
              <View style={styles.telemetryCell}>
                <Text style={styles.telemetryLabel}>Código Serie / QR</Text>
                <Text style={styles.telemetryValue}>{dev.qrBarcode ?? 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => onNavigateToDiagnostics(dev)}
                testID={`btn-diag-${dev.id}`}
              >
                <Text style={styles.secondaryButtonText}>
                  CONSOLA SNMP / SSH
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onNavigateToInstall(dev)}
                testID={`btn-install-${dev.id}`}
              >
                <Text style={styles.actionButtonText}>
                  REGISTRAR INSTALACIÓN + PDF
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
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
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    flexWrap: 'wrap',
  },
  inputGroup: {
    flex: 1,
    minWidth: 200,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'monospace',
  },
  primaryButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  scanSummaryBanner: {
    marginTop: 12,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 6,
    padding: 10,
  },
  scanSummaryText: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '600',
  },
  listHeader: {
    marginBottom: 10,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.4,
  },
  listHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  deviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  deviceCardSelected: {
    borderColor: '#0284C7',
    borderWidth: 1.5,
  },
  deviceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  vendorBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vendorBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369A1',
  },
  categoryBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  methodBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  methodBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  deviceHostname: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  deviceModel: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  ipBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'flex-end',
  },
  ipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: 'monospace',
  },
  macText: {
    fontSize: 11,
    color: '#475569',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    gap: 12,
  },
  telemetryCell: {
    minWidth: 130,
    flex: 1,
  },
  telemetryLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  telemetryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: 'monospace',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  secondaryButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

