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
  KeychainCredentialMetadata,
  NetworkDevice,
  OutboxQueueItem,
} from '@network-suite/contracts';
import { keychainVault } from '../layers/protocol/protocolLayer';
import { outboxSyncManager, type SyncStatusState } from '../layers/sync/syncLayer';
import { ShieldLockIcon } from '../components/SvgIcons';

interface OutboxSyncScreenProps {
  outbox: OutboxQueueItem[];
  credentialsMeta: KeychainCredentialMetadata[];
  devices: NetworkDevice[];
  syncState: SyncStatusState;
}

export function OutboxSyncScreen({
  outbox,
  credentialsMeta,
  devices,
  syncState,
}: OutboxSyncScreenProps) {
  const selectedDeviceId = devices[0]?.id ?? 'dev-mk-ccr2004';
  const [username, setUsername] = useState('admin-campo');
  const [passwordPlain, setPasswordPlain] = useState('Telecom#2026!Keystore');
  const [snmpCommunity, setSnmpCommunity] = useState('public');
  const [vaultMessage, setVaultMessage] = useState('');

  const pendingItems = outbox.filter((i) => i.status !== 'SYNCED');
  const syncedItems = outbox.filter((i) => i.status === 'SYNCED');

  const handleSaveCredential = async () => {
    const dev = devices.find((d) => d.id === selectedDeviceId) ?? devices[0];
    if (!dev) return;
    const saved = await keychainVault.saveEquipmentCredential({
      deviceId: dev.id,
      targetIp: dev.ipAddress,
      username,
      passwordPlain,
      snmpCommunity,
    });
    setPasswordPlain('');
    setVaultMessage(
      `Credencial resguardada en Hardware Keystore: ${saved.serviceKey} (Contraseña en texto plano descartada de memoria).`
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Panel 1: Cola de Sincronización Diferida (Patrón Outbox + NetInfo) */}
      <View style={styles.card}>
        <Text style={styles.sectionTag}>
          CAPA 05 — SYNC LAYER (RF-07 OUTBOX PATTERN & @react-native-community/netinfo)
        </Text>
        <Text style={styles.title}>
          Cola de Sincronización Diferida (Outbox) y Resiliencia Offline
        </Text>
        <Text style={styles.subtitle}>
          Las instalaciones, reportes PDF y diagnósticos se encolan transaccionalmente en WatermelonDB y se despachan automáticamente con Idempotency-Key y backoff exponencial al recuperar conectividad.
        </Text>

        <View style={styles.netStatusBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.netStatusLabel}>
              ESTADO DE CONECTIVIDAD (@react-native-community/netinfo):{' '}
              <Text
                style={{
                  color: syncState.isOnline ? '#047857' : '#B91C1C',
                  fontWeight: '700',
                }}
              >
                {syncState.isOnline ? 'ONLINE (CONECTADO)' : 'OFFLINE (MODO CAMPO SIN SEÑAL)'}
              </Text>
            </Text>
            <Text style={styles.netStatusSub}>{syncState.lastSyncMessage}</Text>
          </View>

          <View style={styles.netButtonsRow}>
            <TouchableOpacity
              style={[
                styles.toggleNetBtn,
                syncState.isOnline ? styles.toggleOfflineBtn : styles.toggleOnlineBtn,
              ]}
              onPress={() => outboxSyncManager.setConnectivityState(!syncState.isOnline)}
              testID="btn-toggle-connectivity"
            >
              <Text style={styles.toggleNetBtnText}>
                {syncState.isOnline ? 'SIMULAR CORTE (OFFLINE)' : 'RECUPERAR CONEXIÓN (ONLINE)'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => outboxSyncManager.flushOutboxQueue()}
              testID="btn-flush-outbox"
            >
              <Text style={styles.primaryButtonText}>SINCRONIZAR COLA AHORA</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiValue}>{pendingItems.length}</Text>
            <Text style={styles.kpiLabel}>Pendientes en Outbox Local</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiValue}>{syncedItems.length}</Text>
            <Text style={styles.kpiLabel}>Sincronizados en Sesión</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiValue}>{syncState.backendSyncedReportsCount}</Text>
            <Text style={styles.kpiLabel}>Reportes PDF en Backend</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiValue}>{syncState.backendSyncedDiagnosticsCount}</Text>
            <Text style={styles.kpiLabel}>Diagnósticos en Backend</Text>
          </View>
        </View>

        <Text style={styles.subHeader}>
          ELEMENTOS EN COLA OUTBOX ({outbox.length})
        </Text>
        {outbox.map((item) => (
          <View key={item.id} style={styles.outboxItemCard}>
            <View style={styles.outboxTopRow}>
              <Text style={styles.outboxTitle}>
                [{item.entityType}] {item.entityId}
              </Text>
              <View
                style={[
                  styles.statusPill,
                  item.status === 'SYNCED' ? styles.statusSynced : styles.statusPending,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    item.status === 'SYNCED'
                      ? styles.statusSyncedText
                      : styles.statusPendingText,
                  ]}
                >
                  {item.status} (Reintentos: {item.retryCount}/{item.maxRetries})
                </Text>
              </View>
            </View>
            <Text style={styles.outboxMeta}>
              Idempotency-Key: {item.idempotencyKey}
            </Text>
            {item.lastError && (
              <Text style={styles.outboxError}>Último error: {item.lastError}</Text>
            )}
          </View>
        ))}
      </View>

      {/* Panel 2: Bóveda de Credenciales Keychain / Keystore (Sección 4.2 & OWASP MASVS) */}
      <View style={styles.card}>
        <View style={styles.vaultTitleRow}>
          <ShieldLockIcon size={18} color="#0284C7" />
          <Text style={styles.sectionTag}>
            SEGURIDAD OWASP MASVS — ALMACENAMIENTO SEGURO DE CREDENCIALES (react-native-keychain)
          </Text>
        </View>
        <Text style={styles.title}>
          Bóveda Criptográfica Keychain / Android Keystore
        </Text>
        <Text style={styles.subtitle}>
          Las contraseñas SSH nunca se persisten en texto plano en WatermelonDB ni en la cola Outbox; se almacenan cifradas en el enclave seguro del sistema operativo.
        </Text>

        <View style={styles.formRow}>
          <View style={styles.fieldCol}>
            <Text style={styles.inputLabel}>Usuario SSH ({selectedDeviceId})</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
            />
          </View>
          <View style={styles.fieldCol}>
            <Text style={styles.inputLabel}>Contraseña SSH (Se cifra en Keystore)</Text>
            <TextInput
              style={styles.input}
              value={passwordPlain}
              onChangeText={setPasswordPlain}
              secureTextEntry
            />
          </View>
          <View style={styles.fieldCol}>
            <Text style={styles.inputLabel}>SNMP Community</Text>
            <TextInput
              style={styles.input}
              value={snmpCommunity}
              onChangeText={setSnmpCommunity}
            />
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSaveCredential}
            testID="btn-save-keychain"
          >
            <Text style={styles.primaryButtonText}>GUARDAR EN KEYCHAIN</Text>
          </TouchableOpacity>
        </View>

        {vaultMessage ? (
          <View style={styles.vaultAlert}>
            <Text style={styles.vaultAlertText}>{vaultMessage}</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 10 }}>
          {credentialsMeta.map((meta) => (
            <View key={meta.serviceKey} style={styles.credRow}>
              <Text style={styles.credUri}>{meta.serviceKey}</Text>
              <Text style={styles.credSub}>
                Equipo: {meta.targetIp} | Usuario: {meta.username} | Enclave: {meta.storageBackend}
              </Text>
            </View>
          ))}
        </View>
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
  netStatusBanner: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  netStatusLabel: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  netStatusSub: {
    fontSize: 12,
    color: '#475569',
    marginTop: 3,
  },
  netButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  toggleNetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  toggleOfflineBtn: {
    backgroundColor: '#DC2626',
  },
  toggleOnlineBtn: {
    backgroundColor: '#059669',
  },
  toggleNetBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  kpiBox: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0284C7',
    fontFamily: 'monospace',
  },
  kpiLabel: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    textAlign: 'center',
  },
  subHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  outboxItemCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  outboxTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  outboxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: 'monospace',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusSynced: {
    backgroundColor: '#ECFDF5',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusSyncedText: {
    color: '#047857',
  },
  statusPendingText: {
    color: '#B45309',
  },
  outboxMeta: {
    fontSize: 11,
    color: '#475569',
    fontFamily: 'monospace',
  },
  outboxError: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 2,
  },
  vaultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'flex-end',
  },
  fieldCol: {
    flex: 1,
    minWidth: 150,
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  vaultAlert: {
    marginTop: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 6,
    padding: 8,
  },
  vaultAlertText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  credRow: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  credUri: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
    fontFamily: 'monospace',
  },
  credSub: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
});

