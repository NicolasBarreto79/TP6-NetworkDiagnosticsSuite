import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import type {
  NetworkDevice,
  SnmpTelemetrySnapshot,
  SshExecutionResult,
} from '@network-suite/contracts';
import { localStore, type LocalStoreSnapshot } from './src/layers/store/localStore';
import { scanLocalNetworkLan } from './src/layers/discovery/discoveryLayer';
import { outboxSyncManager, type SyncStatusState } from './src/layers/sync/syncLayer';
import {
  HistoryClockIcon,
  OutboxCloudSyncIcon,
  QrReportIcon,
  RadarLanIcon,
  TerminalProtocolIcon,
} from './src/components/SvgIcons';
import { LanDiscoveryScreen } from './src/screens/LanDiscoveryScreen';
import { DiagnosticsConsoleScreen } from './src/screens/DiagnosticsConsoleScreen';
import { InstallationReportScreen } from './src/screens/InstallationReportScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { OutboxSyncScreen } from './src/screens/OutboxSyncScreen';

type ActiveTab = 'DISCOVERY' | 'DIAGNOSTICS' | 'INSTALLATION' | 'HISTORY' | 'OUTBOX';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('DISCOVERY');
  const [storeSnap, setStoreSnap] = useState<LocalStoreSnapshot>(
    localStore.getSnapshot()
  );
  const [syncState, setSyncState] = useState<SyncStatusState>(
    outboxSyncManager.getState()
  );
  const [selectedDevice, setSelectedDevice] = useState<NetworkDevice | null>(null);
  const [latestSnmp, setLatestSnmp] = useState<SnmpTelemetrySnapshot | null>(null);
  const [latestSsh, setLatestSsh] = useState<SshExecutionResult | null>(null);

  useEffect(() => {
    const unsubStore = localStore.subscribe((snap) => {
      setStoreSnap(snap);
      if (!selectedDevice && snap.devices.length > 0) {
        setSelectedDevice(snap.devices[0]);
      }
    });
    const unsubSync = outboxSyncManager.subscribe((st) => {
      setSyncState(st);
    });

    // Run initial LAN discovery + automatic «include» SNMP probe on boot
    scanLocalNetworkLan('192.168.1.0/24').then((res) => {
      if (res.discoveredDevices.length > 0) {
        setSelectedDevice(res.discoveredDevices[0]);
      }
    });

    return () => {
      unsubStore();
      unsubSync();
    };
  }, []);

  const currentDevice: NetworkDevice = selectedDevice ??
    storeSnap.devices[0] ?? {
      id: 'dev-mk-ccr2004',
      ipAddress: '192.168.1.1',
      macAddress: 'DC:2C:6E:4A:11:01',
      hostname: 'MK-CCR2004-NODO-CENTRO',
      vendor: 'MikroTik',
      category: 'ROUTER',
      model: 'CCR2004-16G-2S+',
      discoveryMethod: 'HYBRID_MDNS_SNMP',
      qrBarcode: 'QR-MK-CCR2004-SN884120',
      siteName: 'Nodo Centro CDU — Torre Principal',
      snmpReachable: true,
      sshPortOpen: true,
      lastSeenAt: Date.now(),
      syncStatus: 'LOCAL_ONLY',
    };

  const pendingOutboxCount = storeSnap.outbox.filter(
    (i) => i.status !== 'SYNCED'
  ).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Barra Superior de Ingeniería y Estado Offline-First */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.appBrand}>
            NETWORK DIAGNOSTICS SUITE · FCyT UADER
          </Text>
          <Text style={styles.appTitle}>
            Toolkit de Diagnóstico de Infraestructura de Telecomunicaciones
          </Text>
        </View>

        <View style={styles.topRightRow}>
          <TouchableOpacity
            style={[
              styles.netBadge,
              syncState.isOnline ? styles.netBadgeOnline : styles.netBadgeOffline,
            ]}
            onPress={() =>
              outboxSyncManager.setConnectivityState(!syncState.isOnline)
            }
            testID="header-toggle-netinfo"
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: syncState.isOnline ? '#10B981' : '#EF4444' },
              ]}
            />
            <Text
              style={[
                styles.netBadgeText,
                { color: syncState.isOnline ? '#065F46' : '#991B1B' },
              ]}
            >
              {syncState.isOnline ? 'NETINFO: ONLINE' : 'NETINFO: OFFLINE'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outboxCounterPill}
            onPress={() => setActiveTab('OUTBOX')}
            testID="header-outbox-pill"
          >
            <Text style={styles.outboxCounterText}>
              OUTBOX: {pendingOutboxCount} PENDIENTE(S)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenido de Pantalla Activa */}
      <View style={styles.mainBody}>
        {activeTab === 'DISCOVERY' && (
          <LanDiscoveryScreen
            devices={storeSnap.devices}
            selectedDevice={currentDevice}
            onSelectDevice={setSelectedDevice}
            onNavigateToDiagnostics={(dev) => {
              setSelectedDevice(dev);
              setActiveTab('DIAGNOSTICS');
            }}
            onNavigateToInstall={(dev) => {
              setSelectedDevice(dev);
              setActiveTab('INSTALLATION');
            }}
          />
        )}

        {activeTab === 'DIAGNOSTICS' && (
          <DiagnosticsConsoleScreen
            devices={storeSnap.devices}
            selectedDevice={currentDevice}
            onSelectDevice={setSelectedDevice}
            latestSnmp={latestSnmp}
            latestSsh={latestSsh}
            onUpdateSnmp={setLatestSnmp}
            onUpdateSsh={setLatestSsh}
          />
        )}

        {activeTab === 'INSTALLATION' && (
          <InstallationReportScreen
            devices={storeSnap.devices}
            selectedDevice={currentDevice}
            onSelectDevice={setSelectedDevice}
            latestSnmp={latestSnmp}
            latestSsh={latestSsh}
          />
        )}

        {activeTab === 'HISTORY' && <HistoryScreen />}

        {activeTab === 'OUTBOX' && (
          <OutboxSyncScreen
            outbox={storeSnap.outbox}
            credentialsMeta={storeSnap.credentialsMeta}
            devices={storeSnap.devices}
            syncState={syncState}
          />
        )}
      </View>

      {/* Barra de Navegación Inferior Vectorial (0 Emojis) */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[
            styles.navItem,
            activeTab === 'DISCOVERY' && styles.navItemActive,
          ]}
          onPress={() => setActiveTab('DISCOVERY')}
          testID="nav-discovery"
        >
          <RadarLanIcon
            size={18}
            color={activeTab === 'DISCOVERY' ? '#0284C7' : '#64748B'}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'DISCOVERY' && styles.navLabelActive,
            ]}
          >
            Red LAN
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navItem,
            activeTab === 'DIAGNOSTICS' && styles.navItemActive,
          ]}
          onPress={() => setActiveTab('DIAGNOSTICS')}
          testID="nav-diagnostics"
        >
          <TerminalProtocolIcon
            size={18}
            color={activeTab === 'DIAGNOSTICS' ? '#0284C7' : '#64748B'}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'DIAGNOSTICS' && styles.navLabelActive,
            ]}
          >
            SNMP / SSH
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navItem,
            activeTab === 'INSTALLATION' && styles.navItemActive,
          ]}
          onPress={() => setActiveTab('INSTALLATION')}
          testID="nav-installation"
        >
          <QrReportIcon
            size={18}
            color={activeTab === 'INSTALLATION' ? '#0284C7' : '#64748B'}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'INSTALLATION' && styles.navLabelActive,
            ]}
          >
            QR y PDF
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navItem,
            activeTab === 'HISTORY' && styles.navItemActive,
          ]}
          onPress={() => setActiveTab('HISTORY')}
          testID="nav-history"
        >
          <HistoryClockIcon
            size={18}
            color={activeTab === 'HISTORY' ? '#0284C7' : '#64748B'}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'HISTORY' && styles.navLabelActive,
            ]}
          >
            Historial
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navItem,
            activeTab === 'OUTBOX' && styles.navItemActive,
          ]}
          onPress={() => setActiveTab('OUTBOX')}
          testID="nav-outbox"
        >
          <OutboxCloudSyncIcon
            size={18}
            color={activeTab === 'OUTBOX' ? '#0284C7' : '#64748B'}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'OUTBOX' && styles.navLabelActive,
            ]}
          >
            Outbox ({pendingOutboxCount})
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  appBrand: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
    letterSpacing: 0.7,
  },
  appTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  topRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  netBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    gap: 6,
  },
  netBadgeOnline: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
  },
  netBadgeOffline: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  netBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  outboxCounterPill: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  outboxCounterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: 'monospace',
  },
  mainBody: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    gap: 3,
  },
  navItemActive: {
    backgroundColor: '#F0F9FF',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  navLabelActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
});

