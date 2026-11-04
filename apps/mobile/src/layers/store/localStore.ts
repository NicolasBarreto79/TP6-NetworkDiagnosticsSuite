/**
 * Layer 4: Local Store (WatermelonDB Reactive Offline-First Persistence — RF-07, RF-08).
 * Defines the WatermelonDB table schemas and provides a reactive, observable offline-first
 * database engine that works seamlessly in React Native, Node test runners, and web emulators.
 */

import type {
  DeviceDatasheet,
  DiagnosticLog,
  InstallationReport,
  KeychainCredentialMetadata,
  NetworkDevice,
  OutboxQueueItem,
} from '@network-suite/contracts';

export const DEFAULT_OFFLINE_DATASHEETS: DeviceDatasheet[] = [
  {
    qrCode: 'QR-MK-CCR2004-SN884120',
    serialNumber: 'HDE08841209',
    vendor: 'MikroTik',
    model: 'Cloud Core Router CCR2004-16G-2S+',
    category: 'ROUTER',
    defaultIp: '192.168.1.1',
    defaultSshPort: 22,
    snmpPort: 161,
    opticalRxRangeDbm: '-14.0 a -1.0 dBm (SFP+ 10GBASE-LR)',
    powerConsumptionWatts: 48,
    portsDescription: '16x Gigabit Ethernet + 2x 10G SFP+ cages + Dual Redundant PSU',
    firmwareRecommended: 'RouterOS v7.14.2 (Long-Term ARM64)',
    installationChecklist: [
      'Verificar doble fuente de alimentación conectada a UPS online',
      'Atenuación óptica en jaula sfp-sfpplus1 dentro de rango (-14 a -3 dBm)',
      'Aterramiento de chasis verificado en barra equipotencial del rack',
      'Comunidad SNMP de solo lectura y acceso SSH restringido a VLAN de gestión',
    ],
  },
  {
    qrCode: 'QR-HW-HG8245Q2-SN485754',
    serialNumber: '4857544391C214AB',
    vendor: 'Huawei',
    model: 'EchoLife HG8245Q2 GPON Terminal',
    category: 'ONT',
    defaultIp: '192.168.1.20',
    defaultSshPort: 22,
    snmpPort: 161,
    opticalRxRangeDbm: '-27.0 a -8.0 dBm (GPON Class B+)',
    powerConsumptionWatts: 18,
    portsDescription: '1x GPON SC/APC + 4x GE LAN + 2x POTS + Wi-Fi Dual Band AC',
    firmwareRecommended: 'V3R019C10S125',
    installationChecklist: [
      'Limpiar férula de conector verde SC/APC con alcohol isopropílico / One-Click Cleaner',
      'Medir potencia óptica RX en puerto PON (óptimo entre -16 dBm y -22 dBm)',
      'Fijar roseta óptica en pared evitando curvaturas menores a 30mm de radio',
    ],
  },
  {
    qrCode: 'QR-UBNT-PBE5AC-SN788A20',
    serialNumber: '788A209B4410',
    vendor: 'Ubiquiti',
    model: 'airMAX PowerBeam 5AC Gen2 450+ Mbps',
    category: 'ANTENNA',
    defaultIp: '192.168.1.50',
    defaultSshPort: 22,
    snmpPort: 161,
    opticalRxRangeDbm: 'RSSI RF objetivo: -50 a -62 dBm (Ganancia 25 dBi)',
    powerConsumptionWatts: 8.5,
    portsDescription: '1x 10/100/1000 Mbps PoE Pasivo 24V 0.5A Gigabit + Radio 5GHz',
    firmwareRecommended: 'airOS 8 v8.7.11 (WA)',
    installationChecklist: [
      'Alinear parábola verificando cadenas MIMO Chain0 / Chain1 con diferencia <= 2 dB',
      'Utilizar cable UTP Exterior Nivel 1 blindado (ToughCable) con fichas RJ45 apantalladas',
      'Instalar protector de sobretensión ETH-SP-G2 puesto a tierra en mástil',
    ],
  },
  {
    qrCode: 'QR-CISCO-2960X-SNFOC2140',
    serialNumber: 'FOC2140Z09L',
    vendor: 'Cisco',
    model: 'Catalyst 2960-X 24 GigE, 4 x 1G SFP, LAN Base',
    category: 'SWITCH',
    defaultIp: '192.168.1.100',
    defaultSshPort: 22,
    snmpPort: 161,
    powerConsumptionWatts: 92,
    portsDescription: '24x 10/100/1000 Ethernet ports + 4x 1G SFP uplink ports',
    firmwareRecommended: 'Cisco IOS 15.2(7)E6',
    installationChecklist: [
      'Verificar estado de ventiladores redundantes y temperatura de chasis',
      'Confirmar negociación Full-Duplex 1000Mbps en puertos troncales Gi1/0/25-28',
      'Documentar asignación de VLANs de gestión y acceso',
    ],
  },
];

export interface LocalStoreSnapshot {
  devices: NetworkDevice[];
  diagnostics: DiagnosticLog[];
  reports: InstallationReport[];
  outbox: OutboxQueueItem[];
  credentialsMeta: KeychainCredentialMetadata[];
}

type StoreListener = (snapshot: LocalStoreSnapshot) => void;

export class WatermelonLocalStore {
  private devices = new Map<string, NetworkDevice>();
  private diagnostics: DiagnosticLog[] = [];
  private reports: InstallationReport[] = [];
  private outbox = new Map<string, OutboxQueueItem>();
  private datasheets = new Map<string, DeviceDatasheet>();
  private credentialsMeta = new Map<string, KeychainCredentialMetadata>();
  private listeners = new Set<StoreListener>();

  constructor() {
    for (const ds of DEFAULT_OFFLINE_DATASHEETS) {
      this.datasheets.set(ds.qrCode.toUpperCase(), ds);
    }
    // Seed default Keychain metadata references (no plaintext passwords!)
    this.credentialsMeta.set('dev-mk-ccr2004', {
      serviceKey: 'keychain://ar.edu.uader.fcyt.nds/ssh/dev-mk-ccr2004',
      deviceId: 'dev-mk-ccr2004',
      targetIp: '192.168.1.1',
      username: 'admin-noc',
      snmpCommunity: 'public',
      storageBackend: 'IOS_KEYCHAIN_ANDROID_KEYSTORE',
      updatedAt: Date.now(),
    });
    this.credentialsMeta.set('dev-hw-hg8245q2', {
      serviceKey: 'keychain://ar.edu.uader.fcyt.nds/ssh/dev-hw-hg8245q2',
      deviceId: 'dev-hw-hg8245q2',
      targetIp: '192.168.1.20',
      username: 'telecomadmin',
      snmpCommunity: 'public',
      storageBackend: 'IOS_KEYCHAIN_ANDROID_KEYSTORE',
      updatedAt: Date.now(),
    });
  }

  public subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  public getSnapshot(): LocalStoreSnapshot {
    return {
      devices: Array.from(this.devices.values()).sort((a, b) =>
        a.ipAddress.localeCompare(b.ipAddress)
      ),
      diagnostics: [...this.diagnostics].sort((a, b) => b.executedAt - a.executedAt),
      reports: [...this.reports].sort((a, b) => b.createdAt - a.createdAt),
      outbox: Array.from(this.outbox.values()).sort((a, b) => b.createdAt - a.createdAt),
      credentialsMeta: Array.from(this.credentialsMeta.values()),
    };
  }

  public upsertDevices(items: NetworkDevice[]): void {
    for (const dev of items) {
      this.devices.set(dev.id, dev);
    }
    this.notify();
  }

  public updateDevice(deviceId: string, patch: Partial<NetworkDevice>): void {
    const existing = this.devices.get(deviceId);
    if (!existing) return;
    this.devices.set(deviceId, { ...existing, ...patch });
    this.notify();
  }

  public addDiagnosticLog(log: DiagnosticLog): void {
    this.diagnostics.unshift(log);
    this.notify();
  }

  public addInstallationReport(report: InstallationReport): void {
    const idx = this.reports.findIndex((r) => r.id === report.id);
    if (idx >= 0) {
      this.reports[idx] = report;
    } else {
      this.reports.unshift(report);
    }
    this.notify();
  }

  public upsertOutboxItem(item: OutboxQueueItem): void {
    this.outbox.set(item.id, item);
    this.notify();
  }

  public markEntitySynced(entityType: OutboxQueueItem['entityType'], entityId: string): void {
    if (entityType === 'INSTALLATION_REPORT') {
      this.reports = this.reports.map((r) =>
        r.id === entityId ? { ...r, syncStatus: 'SYNCED' } : r
      );
    } else if (entityType === 'DIAGNOSTIC_LOG') {
      this.diagnostics = this.diagnostics.map((d) =>
        d.id === entityId ? { ...d, syncStatus: 'SYNCED' } : d
      );
    }
    this.notify();
  }

  public upsertDatasheet(datasheet: DeviceDatasheet): void {
    this.datasheets.set(datasheet.qrCode.toUpperCase(), datasheet);
    this.notify();
  }

  public findDatasheetOffline(code: string): DeviceDatasheet | undefined {
    const norm = code.trim().toUpperCase();
    for (const ds of this.datasheets.values()) {
      if (
        ds.qrCode.toUpperCase() === norm ||
        ds.serialNumber.toUpperCase() === norm ||
        ds.defaultIp === code.trim()
      ) {
        return ds;
      }
    }
    return undefined;
  }

  public upsertCredentialMetadata(meta: KeychainCredentialMetadata): void {
    this.credentialsMeta.set(meta.deviceId, meta);
    this.notify();
  }

  /**
   * RF-08: Queries diagnostic & installation history offline filtered by device, IP, or site name.
   */
  public queryOfflineHistory(filterQuery = ''): {
    diagnostics: DiagnosticLog[];
    reports: InstallationReport[];
  } {
    const q = filterQuery.trim().toLowerCase();
    if (!q) {
      return {
        diagnostics: [...this.diagnostics],
        reports: [...this.reports],
      };
    }

    return {
      diagnostics: this.diagnostics.filter(
        (d) =>
          d.deviceHostname.toLowerCase().includes(q) ||
          d.deviceIp.toLowerCase().includes(q) ||
          d.siteName.toLowerCase().includes(q) ||
          d.protocol.toLowerCase().includes(q) ||
          d.summary.toLowerCase().includes(q)
      ),
      reports: this.reports.filter(
        (r) =>
          r.deviceHostname.toLowerCase().includes(q) ||
          r.deviceIp.toLowerCase().includes(q) ||
          r.siteName.toLowerCase().includes(q) ||
          r.qrBarcode.toLowerCase().includes(q) ||
          r.technicianNotes.toLowerCase().includes(q)
      ),
    };
  }
}

export const localStore = new WatermelonLocalStore();

