import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import { localStore } from '../layers/store/localStore';

export function HistoryScreen() {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = localStore.queryOfflineHistory(searchQuery);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sectionTag}>
          CAPA 04 — LOCAL STORE WATERMELONDB (RF-08 HISTORIAL OFFLINE)
        </Text>
        <Text style={styles.title}>
          Historial de Diagnósticos y Reportes por Equipo / Sitio
        </Text>
        <Text style={styles.subtitle}>
          Consultable 100% sin conexión a internet desde las tablas indexadas de WatermelonDB (`installation_reports` y `diagnostic_logs`).
        </Text>

        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Filtrar por IP, hostname, sitio, protocolo (SNMP/SSH) o código QR..."
          testID="input-history-search"
        />
      </View>

      <Text style={styles.groupHeader}>
        REPORTES PDF DE INSTALACIÓN GENERADOS ({filtered.reports.length})
      </Text>
      {filtered.reports.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No hay reportes de instalación que coincidan con el filtro actual.
          </Text>
        </View>
      ) : (
        filtered.reports.map((rep) => (
          <View key={rep.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemTitle}>
                {rep.id} — {rep.deviceHostname} ({rep.deviceIp})
              </Text>
              <View
                style={[
                  styles.syncBadge,
                  rep.syncStatus === 'SYNCED'
                    ? styles.syncBadgeOk
                    : styles.syncBadgePending,
                ]}
              >
                <Text
                  style={[
                    styles.syncBadgeText,
                    rep.syncStatus === 'SYNCED'
                      ? styles.syncBadgeTextOk
                      : styles.syncBadgeTextPending,
                  ]}
                >
                  {rep.syncStatus}
                </Text>
              </View>
            </View>
            <Text style={styles.itemMeta}>
              Sitio: {rep.siteName} | QR: {rep.qrBarcode} | Técnico: {rep.technicianName}
            </Text>
            <Text style={styles.itemMeta}>
              PDF Local: {rep.pdfFileName} ({(rep.pdfSizeBytes / 1024).toFixed(1)} KB) | Fotos: {rep.photos.length} | GPS: {rep.coordinates.latitude.toFixed(5)}, {rep.coordinates.longitude.toFixed(5)}
            </Text>
            <Text style={styles.itemNotes}>{rep.technicianNotes}</Text>
          </View>
        ))
      )}

      <Text style={[styles.groupHeader, { marginTop: 12 }]}>
        BITÁCORA DE DIAGNÓSTICOS SNMP / SSH / LAN ({filtered.diagnostics.length})
      </Text>
      {filtered.diagnostics.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No hay diagnósticos registrados en WatermelonDB todavía.
          </Text>
        </View>
      ) : (
        filtered.diagnostics.map((diag) => (
          <View key={diag.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemTitle}>
                [{diag.protocol}] {diag.deviceHostname} ({diag.deviceIp})
              </Text>
              <Text style={styles.timeText}>
                {new Date(diag.executedAt).toLocaleTimeString('es-AR')} · {diag.syncStatus}
              </Text>
            </View>
            <Text style={styles.itemMeta}>Sitio: {diag.siteName}</Text>
            <Text style={styles.itemNotes}>{diag.summary}</Text>
          </View>
        ))
      )}
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
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  groupHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 12,
    color: '#64748B',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  timeText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'monospace',
  },
  syncBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  syncBadgeOk: {
    backgroundColor: '#ECFDF5',
  },
  syncBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  syncBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  syncBadgeTextOk: {
    color: '#047857',
  },
  syncBadgeTextPending: {
    color: '#B45309',
  },
  itemMeta: {
    fontSize: 11,
    color: '#475569',
    marginBottom: 2,
  },
  itemNotes: {
    fontSize: 12,
    color: '#0F172A',
    marginTop: 4,
    fontFamily: 'monospace',
  },
});

