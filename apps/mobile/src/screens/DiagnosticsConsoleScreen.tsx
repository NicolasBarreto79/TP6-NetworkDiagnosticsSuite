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
import {
  getPresetsByVendor,
  MIB2_OIDS,
  type NetworkDevice,
  type SnmpTelemetrySnapshot,
  type SshExecutionResult,
} from '@network-suite/contracts';
import {
  executeDeviceSshCommand,
  queryDeviceSnmp,
} from '../layers/protocol/protocolLayer';

interface DiagnosticsConsoleScreenProps {
  devices: NetworkDevice[];
  selectedDevice: NetworkDevice;
  onSelectDevice: (device: NetworkDevice) => void;
  latestSnmp: SnmpTelemetrySnapshot | null;
  latestSsh: SshExecutionResult | null;
  onUpdateSnmp: (snapshot: SnmpTelemetrySnapshot) => void;
  onUpdateSsh: (result: SshExecutionResult) => void;
}

export function DiagnosticsConsoleScreen({
  devices,
  selectedDevice,
  onSelectDevice,
  latestSnmp,
  latestSsh,
  onUpdateSnmp,
  onUpdateSsh,
}: DiagnosticsConsoleScreenProps) {
  const [community, setCommunity] = useState('public');
  const [isQueryingSnmp, setIsQueryingSnmp] = useState(false);
  const [isRunningSsh, setIsRunningSsh] = useState(false);

  const vendorPresets = getPresetsByVendor(selectedDevice.vendor);
  const [selectedPresetId, setSelectedPresetId] = useState(
    vendorPresets[0]?.id ?? 'mikrotik-interfaces'
  );

  const handleQuerySnmp = async () => {
    setIsQueryingSnmp(true);
    try {
      const snap = await queryDeviceSnmp({
        deviceId: selectedDevice.id,
        targetIp: selectedDevice.ipAddress,
        hostname: selectedDevice.hostname,
        siteName: selectedDevice.siteName,
        macAddress: selectedDevice.macAddress,
        community,
      });
      onUpdateSnmp(snap);
    } finally {
      setIsQueryingSnmp(false);
    }
  };

  const handleRunSsh = async (presetIdToRun?: string) => {
    const targetPreset = presetIdToRun ?? selectedPresetId;
    setSelectedPresetId(targetPreset);
    setIsRunningSsh(true);
    try {
      const res = await executeDeviceSshCommand({
        deviceId: selectedDevice.id,
        targetIp: selectedDevice.ipAddress,
        hostname: selectedDevice.hostname,
        vendor: selectedDevice.vendor,
        siteName: selectedDevice.siteName,
        presetId: targetPreset,
      });
      onUpdateSsh(res);
    } finally {
      setIsRunningSsh(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Selector de Equipo Objetivo */}
      <View style={styles.card}>
        <Text style={styles.sectionTag}>CAPA 02 — PROTOCOL LAYER (RF-02 SNMPv2c BER & RF-03 SSH)</Text>
        <Text style={styles.title}>Consola de Diagnóstico de Bajo Nivel (UDP/161 & TCP/22)</Text>
        <Text style={styles.subtitle}>
          Seleccione el equipo objetivo de la LAN para inspeccionar sus OIDs MIB-II mediante paquetes binarios ASN.1 BER o ejecutar rutinas de diagnóstico SSH autenticado vía Keychain.
        </Text>

        <View style={styles.devicePillsRow}>
          {devices.map((dev) => {
            const active = dev.id === selectedDevice.id;
            return (
              <TouchableOpacity
                key={dev.id}
                style={[styles.devicePill, active && styles.devicePillActive]}
                onPress={() => {
                  onSelectDevice(dev);
                  const presets = getPresetsByVendor(dev.vendor);
                  if (presets[0]) setSelectedPresetId(presets[0].id);
                }}
              >
                <Text style={[styles.devicePillText, active && styles.devicePillTextActive]}>
                  {dev.ipAddress} · {dev.vendor}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Panel 1: Cliente SNMP v1/v2c (ASN.1 BER sobre UDP/161) */}
      <View style={styles.card}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelBadge}>RF-02 · PROTOCOLO SNMP v1/v2c (UDP/161)</Text>
            <Text style={styles.panelTitle}>
              Consulta de OIDs MIB-II ({selectedDevice.hostname} — {selectedDevice.ipAddress})
            </Text>
          </View>
        </View>

        <View style={styles.snmpControlsRow}>
          <View style={{ flex: 1, minWidth: 160 }}>
            <Text style={styles.inputLabel}>Community String (RO)</Text>
            <TextInput
              style={styles.input}
              value={community}
              onChangeText={setCommunity}
              placeholder="public"
            />
          </View>
          <View style={{ flex: 2, minWidth: 220 }}>
            <Text style={styles.inputLabel}>OIDs Estándar MIB-II Solicitados (RFC 1213)</Text>
            <Text style={styles.oidSummaryBox}>
              {MIB2_OIDS.sysName}, {MIB2_OIDS.sysUpTime}, {MIB2_OIDS.ifPhysAddress1}, {MIB2_OIDS.ifInOctets1}, {MIB2_OIDS.ifOutOctets1}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleQuerySnmp}
            disabled={isQueryingSnmp}
            testID="btn-query-snmp"
          >
            {isQueryingSnmp ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>ENVIAR PDU GET-REQUEST (UDP/161)</Text>
            )}
          </TouchableOpacity>
        </View>

        {latestSnmp && (
          <View style={styles.snmpResultBox}>
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>sysName (1.3.6.1.2.1.1.5.0)</Text>
                <Text style={styles.metricValue}>{latestSnmp.sysName}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>sysUpTime (1.3.6.1.2.1.1.3.0)</Text>
                <Text style={styles.metricValue}>
                  {latestSnmp.sysUpTimeFormatted} ({latestSnmp.sysUpTimeTicks} ticks)
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>RTT Socket UDP / RequestID</Text>
                <Text style={styles.metricValue}>
                  {latestSnmp.roundTripMs} ms | ID #{latestSnmp.requestId}
                </Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Interfaz (ifDescr.1 / ifOperStatus.1)</Text>
                <Text style={styles.metricValue}>
                  {latestSnmp.interfaces[0]?.ifDescr} [{latestSnmp.interfaces[0]?.ifOperStatus}]
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>MAC Física (ifPhysAddress.1)</Text>
                <Text style={styles.metricValue}>
                  {latestSnmp.interfaces[0]?.ifPhysAddressMac}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Tráfico RX / TX (Counter32)</Text>
                <Text style={styles.metricValue}>
                  RX: {(latestSnmp.interfaces[0]?.ifInOctets ?? 0).toLocaleString('es-AR')} B | TX: {(latestSnmp.interfaces[0]?.ifOutOctets ?? 0).toLocaleString('es-AR')} B
                </Text>
              </View>
            </View>

            <View style={styles.berHexBox}>
              <Text style={styles.berHexTitle}>
                INSPECTOR DE TRAMA BINARIA ASN.1 BER (TLV CODEC PROPIO)
              </Text>
              <Text style={styles.berHexLabel}>TX GetRequest-PDU (0xA0):</Text>
              <Text style={styles.berHexCode}>{latestSnmp.rawRequestHex}</Text>
              <Text style={[styles.berHexLabel, { marginTop: 6 }]}>
                RX GetResponse-PDU (0xA2):
              </Text>
              <Text style={styles.berHexCode}>{latestSnmp.rawResponseHex}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Panel 2: Cliente SSH Embebido (RF-03 + Keychain) */}
      <View style={styles.card}>
        <Text style={styles.panelBadge}>RF-03 · CLIENTE SSH EMBEBIDO (TCP/22 + KEYCHAIN VAULT)</Text>
        <Text style={styles.panelTitle}>
          Comandos de Diagnóstico Predefinidos ({selectedDevice.vendor})
        </Text>
        <Text style={styles.subtitle}>
          Autenticación segura mediante referencia encriptada en Keychain/Keystore (sin contraseñas en texto plano).
        </Text>

        <View style={styles.presetGrid}>
          {vendorPresets.map((preset) => {
            const active = preset.id === selectedPresetId;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[styles.presetCard, active && styles.presetCardActive]}
                onPress={() => handleRunSsh(preset.id)}
                disabled={isRunningSsh}
                testID={`btn-ssh-${preset.id}`}
              >
                <Text style={styles.presetLabel}>{preset.label}</Text>
                <Text style={styles.presetCommand}>$ {preset.command}</Text>
                <Text style={styles.presetDesc}>{preset.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {latestSsh && (
          <View style={styles.terminalBox}>
            <View style={styles.terminalHeader}>
              <Text style={styles.terminalHeaderText}>
                SSH SESSION: {latestSsh.username}@{latestSsh.targetIp}:{latestSsh.port} | Auth: {latestSsh.credentialKeychainRef}
              </Text>
              <Text style={styles.terminalExitBadge}>
                EXIT {latestSsh.exitCode} ({latestSsh.durationMs} ms)
              </Text>
            </View>
            <Text style={styles.terminalOutput}>{latestSsh.stdout}</Text>
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
    fontSize: 18,
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
  devicePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  devicePill: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  devicePillActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  devicePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    fontFamily: 'monospace',
  },
  devicePillTextActive: {
    color: '#FFFFFF',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  panelBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 3,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  snmpControlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 5,
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
    fontFamily: 'monospace',
  },
  oidSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 11,
    color: '#475569',
    fontFamily: 'monospace',
  },
  primaryButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  snmpResultBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  metricItem: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 3,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: 'monospace',
  },
  berHexBox: {
    backgroundColor: '#0F172A',
    borderRadius: 6,
    padding: 10,
    marginTop: 4,
  },
  berHexTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
    marginBottom: 6,
  },
  berHexLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  berHexCode: {
    fontSize: 11,
    color: '#E2E8F0',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  presetCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
  },
  presetCardActive: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  presetLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  presetCommand: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  presetDesc: {
    fontSize: 11,
    color: '#475569',
  },
  terminalBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
  },
  terminalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 6,
    marginBottom: 8,
  },
  terminalHeaderText: {
    fontSize: 11,
    color: '#38BDF8',
    fontFamily: 'monospace',
  },
  terminalExitBadge: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  terminalOutput: {
    fontSize: 12,
    color: '#F8FAFC',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});

