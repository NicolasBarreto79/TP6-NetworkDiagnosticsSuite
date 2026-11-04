/**
 * Predefined SSH Diagnostic Command Presets per Telecom Vendor (RF-03).
 * Prevents arbitrary shell injection by restricting field execution to vetted diagnostic routines.
 */

import type { DeviceVendor, SshCommandPreset } from '../models.js';

export const SSH_VENDOR_PRESETS: SshCommandPreset[] = [
  {
    id: 'mikrotik-interfaces',
    vendor: 'MikroTik',
    label: 'Estado de Interfaces y Tráfico',
    command: '/interface print stats detail without-paging',
    description: 'Lista interfaces activas, paquetes RX/TX, errores CRC y drops en RouterOS.',
  },
  {
    id: 'mikrotik-system-resource',
    vendor: 'MikroTik',
    label: 'Recursos de CPU, Memoria y Uptime',
    command: '/system resource print',
    description: 'Muestra carga de CPU, memoria libre, versión de RouterOS, arquitectura y uptime.',
  },
  {
    id: 'mikrotik-ip-routes',
    vendor: 'MikroTik',
    label: 'Tabla de Enrutamiento Activa',
    command: '/ip route print detail where active=yes',
    description: 'Verifica puerta de enlace predeterminada y rutas OSPF/BGP activas.',
  },
  {
    id: 'huawei-gpon-optical',
    vendor: 'Huawei',
    label: 'Potencia Óptica GPON (ONT/OLT)',
    command: 'display ont optical-info 0 all',
    description: 'Consulta atenuación óptica RX/TX (dBm), temperatura del láser y voltaje OLT.',
  },
  {
    id: 'huawei-interface-brief',
    vendor: 'Huawei',
    label: 'Resumen de Puertos e Interfaces',
    command: 'display ip interface brief',
    description: 'Estado físico y de protocolo de las interfaces VLAN y WAN de gestión.',
  },
  {
    id: 'ubiquiti-wireless-status',
    vendor: 'Ubiquiti',
    label: 'Calidad de Enlace Inalámbrico (AirMAX)',
    command: 'mca-status | grep -E "signal|noise|ccq|wlanRxRate|wlanTxRate"',
    description: 'Reporta nivel de señal RSSI (dBm), piso de ruido, CCQ y modulación MIMO.',
  },
  {
    id: 'ubiquiti-system-uptime',
    vendor: 'Ubiquiti',
    label: 'Uptime y Carga de Sistema AirOS',
    command: 'uptime && free -m && ip -br addr',
    description: 'Tiempo en línea, memoria RAM disponible y direcciones IPv4 configuradas.',
  },
  {
    id: 'cisco-show-interfaces',
    vendor: 'Cisco',
    label: 'Show Interfaces Status & Counters',
    command: 'show interfaces status | include connected',
    description: 'Muestra puertos troncales y de acceso activos, VLAN nativa, duplex y velocidad.',
  },
  {
    id: 'cisco-show-version',
    vendor: 'Cisco',
    label: 'Show Version & Uptime',
    command: 'show version | include uptime|isco IOS|bytes of memory',
    description: 'Versión de Cisco IOS XE, número de serie del chasis y tiempo activo sin reinicios.',
  },
];

export function getPresetsByVendor(vendor: DeviceVendor): SshCommandPreset[] {
  const matches = SSH_VENDOR_PRESETS.filter((p) => p.vendor === vendor);
  return matches.length > 0 ? matches : SSH_VENDOR_PRESETS;
}

/**
 * Generates realistic telecom CLI output for the embedded SSH diagnostic console and backend responder.
 */
export function buildRealisticSshOutput(params: {
  presetId: string;
  targetIp: string;
  hostname: string;
  vendor: DeviceVendor;
}): string {
  const timestamp = new Date().toISOString();

  switch (params.presetId) {
    case 'mikrotik-interfaces':
      return [
        `[${timestamp}] ${params.hostname} (${params.targetIp}) > /interface print stats detail without-paging`,
        `Flags: D - dynamic, X - disabled, R - running, S - slave`,
        ` 0  R  name="ether1-uplink-ftth" type="ether" mtu=1500 actual-mtu=1500 l2mtu=1598`,
        `       mac-address=DC:2C:6E:4A:11:01 rx-byte=48,291,044,120 tx-byte=19,402,881,024`,
        `       rx-packet=38,912,440 tx-packet=21,004,118 rx-drop=0 tx-drop=0 rx-error=0`,
        ` 1  RS name="sfp-sfpplus1-core" type="ether" mtu=1500 actual-mtu=1500 l2mtu=1600`,
        `       mac-address=DC:2C:6E:4A:11:02 rx-byte=128,904,112,000 tx-byte=114,552,900,112`,
        `       rx-packet=94,120,005 tx-packet=88,410,220 rx-drop=0 tx-drop=0 rx-error=0`,
      ].join('\n');

    case 'mikrotik-system-resource':
      return [
        `[${timestamp}] ${params.hostname} (${params.targetIp}) > /system resource print`,
        `                   uptime: 42d18h14m09s`,
        `                  version: 7.14.2 (stable)`,
        `               build-time: 2026-05-14 11:20:00`,
        `         factory-software: 7.8`,
        `              free-memory: 842.4MiB`,
        `             total-memory: 1024.0MiB`,
        `                      cpu: ARM64`,
        `                cpu-count: 4`,
        `            cpu-frequency: 1400MHz`,
        `                 cpu-load: 6%`,
        `           architecture-name: arm64`,
        `               board-name: RB5009UG+S+IN`,
      ].join('\n');

    case 'huawei-gpon-optical':
      return [
        `[${timestamp}] ${params.hostname} (${params.targetIp}) > display ont optical-info 0 all`,
        `  -----------------------------------------------------------------------------`,
        `  ONU NNI port ID                        : 0`,
        `  Module type                            : GPON Class B+`,
        `  Optical Vendor Name                    : HUAWEI-OPTICS`,
        `  Rx optical power(dBm)                  : -18.42 (Normal range: -27.0 to -8.0)`,
        `  Tx optical power(dBm)                  : 2.35   (Normal range: 0.5 to 5.0)`,
        `  Laser bias current(mA)                 : 11.40`,
        `  Temperature(C)                         : 41.2`,
        `  Voltage(V)                             : 3.29`,
        `  OLT Rx ONT optical power(dBm)          : -19.10`,
        `  -----------------------------------------------------------------------------`,
      ].join('\n');

    case 'ubiquiti-wireless-status':
      return [
        `[${timestamp}] ${params.hostname} (${params.targetIp}) > mca-status`,
        `deviceName=${params.hostname},deviceId=78:8A:20:9B:44:10,firmwareVersion=WA.ar934x.v8.7.11`,
        `signal=-54`,
        `chain0Signal=-56`,
        `chain1Signal=-55`,
        `noise=-96`,
        `ccq=991`,
        `wlanRxRate=300.0`,
        `wlanTxRate=300.0`,
        `wlanPollingQuality=98`,
        `wlanPollingCapacity=95`,
        `distance=1850`,
      ].join('\n');

    case 'cisco-show-interfaces':
      return [
        `[${timestamp}] ${params.hostname}# show interfaces status | include connected`,
        `Gi1/0/1   Trunk-Core-Router      connected    trunk      a-full a-1000 1000BaseLX SFP`,
        `Gi1/0/2   AP-Ubiquiti-SectorN    connected    120        a-full a-1000 10/100/1000BaseTX`,
        `Gi1/0/3   OLT-Huawei-Uplink      connected    200        a-full a-1000 10/100/1000BaseTX`,
        `Te1/0/1   Backbone-Anillo-Sur    connected    trunk      full    10G   SFP-10GBase-LR`,
      ].join('\n');

    default:
      return [
        `[${timestamp}] SSH session on ${params.hostname} (${params.targetIp})`,
        `Vendor: ${params.vendor} | Status: ONLINE | Auth: Keystore Verified`,
        `Uptime: 19 days, 08:42:11, load average: 0.08, 0.05, 0.01`,
        `eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP`,
        `    inet ${params.targetIp}/24 brd 192.168.1.255 scope global eth0`,
      ].join('\n');
  }
}

