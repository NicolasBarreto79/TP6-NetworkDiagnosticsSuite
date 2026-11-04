/**
 * Telecom LAN Topology & QR/Barcode Technical Datasheets Catalog (RF-01, RF-04).
 */

import type { DeviceDatasheet, NetworkDevice } from '@network-suite/contracts';

export interface SimulatedSnmpDeviceState {
  device: NetworkDevice;
  datasheet: DeviceDatasheet;
  sysDescr: string;
  sysLocation: string;
  ifDescr1: string;
  baseUpTimeTicks: number;
  baseInOctets: number;
  baseOutOctets: number;
}

export const TELECOM_LAN_TOPOLOGY: SimulatedSnmpDeviceState[] = [
  {
    device: {
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
    },
    datasheet: {
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
    sysDescr: 'RouterOS CCR2004-16G-2S+ v7.14.2 (arm64)',
    sysLocation: 'Nodo Centro CDU - Gabinete A1',
    ifDescr1: 'sfp-sfpplus1-uplink-10g',
    baseUpTimeTicks: 369_440_900, // ~42.7 days
    baseInOctets: 1_482_910_440,
    baseOutOctets: 819_402_880,
  },
  {
    device: {
      id: 'dev-hw-hg8245q2',
      ipAddress: '192.168.1.20',
      macAddress: '48:FD:8E:91:C2:14',
      hostname: 'HW-ONT-HG8245Q2-ABONADO402',
      vendor: 'Huawei',
      category: 'ONT',
      model: 'EchoLife HG8245Q2 GPON',
      discoveryMethod: 'HYBRID_MDNS_SNMP',
      qrBarcode: 'QR-HW-HG8245Q2-SN485754',
      siteName: 'Caja NAP-14 — Barrio Centro',
      snmpReachable: true,
      sshPortOpen: true,
      lastSeenAt: Date.now(),
      syncStatus: 'LOCAL_ONLY',
    },
    datasheet: {
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
    sysDescr: 'Huawei EchoLife HG8245Q2 GPON ONT V3R019C10',
    sysLocation: 'Caja NAP-14 - Acometida FTTH #402',
    ifDescr1: 'gpon-nni0-optical',
    baseUpTimeTicks: 84_120_500, // ~9.7 days
    baseInOctets: 642_110_800,
    baseOutOctets: 198_440_210,
  },
  {
    device: {
      id: 'dev-ubnt-pbe5ac',
      ipAddress: '192.168.1.50',
      macAddress: '78:8A:20:9B:44:10',
      hostname: 'UBNT-PBE5AC-ENLACE-SUR',
      vendor: 'Ubiquiti',
      category: 'ANTENNA',
      model: 'PowerBeam 5AC Gen2 (PBE-5AC-Gen2)',
      discoveryMethod: 'MDNS_BONJOUR',
      qrBarcode: 'QR-UBNT-PBE5AC-SN788A20',
      siteName: 'Azotea Planta Potabilizadora — Mástil 18m',
      snmpReachable: true,
      sshPortOpen: true,
      lastSeenAt: Date.now(),
      syncStatus: 'LOCAL_ONLY',
    },
    datasheet: {
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
    sysDescr: 'Linux 3.18.134 airOS WA.ar934x.v8.7.11 (PowerBeam 5AC Gen2)',
    sysLocation: 'Azotea Mástil Norte - Sector PtP 5.8GHz',
    ifDescr1: 'ath0-airmax-ptp',
    baseUpTimeTicks: 192_600_400, // ~22.2 days
    baseInOctets: 912_305_110,
    baseOutOctets: 889_120_440,
  },
  {
    device: {
      id: 'dev-cisco-c2960x',
      ipAddress: '192.168.1.100',
      macAddress: '00:1B:54:8A:E3:90',
      hostname: 'SW-CISCO-2960X-ACCESO-P1',
      vendor: 'Cisco',
      category: 'SWITCH',
      model: 'Catalyst WS-C2960X-24TS-L',
      discoveryMethod: 'ARP_SUBNET_SWEEP',
      qrBarcode: 'QR-CISCO-2960X-SNFOC2140',
      siteName: 'Sala de Telecomunicaciones — Gabinete B2',
      snmpReachable: true,
      sshPortOpen: true,
      lastSeenAt: Date.now(),
      syncStatus: 'LOCAL_ONLY',
    },
    datasheet: {
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
    sysDescr: 'Cisco IOS Software, C2960X Software (C2960X-UNIVERSALK9-M), Version 15.2(7)E6',
    sysLocation: 'Sala de Telecomunicaciones - Gabinete B2',
    ifDescr1: 'GigabitEthernet1/0/1',
    baseUpTimeTicks: 518_400_000, // 60 days
    baseInOctets: 2_104_550_900,
    baseOutOctets: 1_940_112_300,
  },
];

export function findDatasheetByQrCode(code: string): DeviceDatasheet | undefined {
  const normalized = code.trim().toUpperCase();
  const match = TELECOM_LAN_TOPOLOGY.find(
    (entry) =>
      entry.datasheet.qrCode.toUpperCase() === normalized ||
      entry.datasheet.serialNumber.toUpperCase() === normalized ||
      entry.device.ipAddress === code.trim()
  );
  return match?.datasheet;
}

export function findSimulatedDeviceByIp(ip: string): SimulatedSnmpDeviceState {
  return (
    TELECOM_LAN_TOPOLOGY.find((entry) => entry.device.ipAddress === ip) ??
    TELECOM_LAN_TOPOLOGY[0]
  );
}

