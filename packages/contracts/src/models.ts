/**
 * Domain models and shared interfaces for TP6: Network Diagnostics Suite
 * Covers RF-01 through RF-08, WatermelonDB schema entities, and Outbox sync contracts.
 */

export type DeviceVendor = 'MikroTik' | 'Ubiquiti' | 'Huawei' | 'Cisco' | 'Generic';

export type DeviceCategory = 'ROUTER' | 'ONT' | 'ANTENNA' | 'SWITCH' | 'HOST';

export type DiscoveryMethod = 'MDNS_BONJOUR' | 'ARP_SUBNET_SWEEP' | 'HYBRID_MDNS_SNMP';

export type SyncStatus = 'LOCAL_ONLY' | 'PENDING_SYNC' | 'SYNCED' | 'CONFLICT';

export interface NetworkDevice {
  id: string;
  ipAddress: string;
  macAddress: string;
  hostname: string;
  vendor: DeviceVendor;
  category: DeviceCategory;
  model: string;
  discoveryMethod: DiscoveryMethod;
  qrBarcode?: string;
  siteName: string;
  snmpReachable: boolean;
  sshPortOpen: boolean;
  sysName?: string;
  sysDescr?: string;
  sysUpTimeTicks?: number;
  sysUpTimeFormatted?: string;
  ifInOctets?: number;
  ifOutOctets?: number;
  lastSeenAt: number;
  syncStatus: SyncStatus;
}

export interface SnmpInterfaceTraffic {
  ifIndex: number;
  ifDescr: string;
  ifPhysAddressMac: string;
  ifOperStatus: 'UP' | 'DOWN' | 'TESTING';
  ifInOctets: number;
  ifOutOctets: number;
  ifSpeedBps: number;
}

export interface SnmpTelemetrySnapshot {
  targetIp: string;
  port: number;
  community: string;
  version: 'v1' | 'v2c';
  requestId: number;
  roundTripMs: number;
  rawRequestHex: string;
  rawResponseHex: string;
  sysName: string;
  sysDescr: string;
  sysUpTimeTicks: number;
  sysUpTimeFormatted: string;
  sysLocation: string;
  interfaces: SnmpInterfaceTraffic[];
  queriedAt: number;
}

export interface SshCommandPreset {
  id: string;
  vendor: DeviceVendor;
  label: string;
  command: string;
  description: string;
}

export interface SshExecutionResult {
  id: string;
  deviceId: string;
  targetIp: string;
  port: number;
  username: string;
  credentialKeychainRef: string;
  presetId: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  executedAt: number;
}

export interface DiagnosticLog {
  id: string;
  deviceId: string;
  deviceIp: string;
  deviceHostname: string;
  siteName: string;
  protocol: 'SNMP' | 'SSH' | 'LAN_DISCOVERY';
  summary: string;
  snmpSnapshot?: SnmpTelemetrySnapshot;
  sshResult?: SshExecutionResult;
  executedAt: number;
  syncStatus: SyncStatus;
}

export interface DeviceDatasheet {
  qrCode: string;
  serialNumber: string;
  vendor: DeviceVendor;
  model: string;
  category: DeviceCategory;
  defaultIp: string;
  defaultSshPort: number;
  snmpPort: number;
  opticalRxRangeDbm?: string;
  powerConsumptionWatts: number;
  portsDescription: string;
  firmwareRecommended: string;
  installationChecklist: string[];
}

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  altitudeMeters?: number;
  capturedAt: number;
}

export interface EvidencePhoto {
  id: string;
  reportId: string;
  uri: string;
  caption: string;
  mimeType: string;
  base64Preview?: string;
  coordinates: GeoCoordinates;
  capturedAt: number;
}

export interface InstallationReport {
  id: string;
  deviceId: string;
  deviceIp: string;
  deviceMac: string;
  deviceHostname: string;
  vendor: DeviceVendor;
  model: string;
  qrBarcode: string;
  siteName: string;
  technicianName: string;
  technicianNotes: string;
  coordinates: GeoCoordinates;
  photos: EvidencePhoto[];
  snmpSnapshot?: SnmpTelemetrySnapshot;
  sshResult?: SshExecutionResult;
  pdfLocalUri: string;
  pdfFileName: string;
  pdfSizeBytes: number;
  createdAt: number;
  syncStatus: SyncStatus;
}

export type OutboxOperationStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'RETRY_SCHEDULED'
  | 'CONFLICT_RESOLVED'
  | 'DEAD_LETTER'
  | 'SYNCED';

export type OutboxEntityType = 'INSTALLATION_REPORT' | 'DIAGNOSTIC_LOG';

export interface OutboxQueueItem {
  id: string;
  idempotencyKey: string;
  entityType: OutboxEntityType;
  entityId: string;
  operation: 'CREATE' | 'UPDATE';
  payloadJson: string;
  status: OutboxOperationStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: number;
  lastError?: string;
  conflictResolutionNote?: string;
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
}

export interface KeychainCredentialMetadata {
  serviceKey: string;
  deviceId: string;
  targetIp: string;
  username: string;
  snmpCommunity: string;
  storageBackend: 'IOS_KEYCHAIN_ANDROID_KEYSTORE';
  updatedAt: number;
}

