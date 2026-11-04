/**
 * Standard MIB-II (RFC 1213) OID Catalog for SNMP v1/v2c Network Diagnostics.
 * Covers the System group (1.3.6.1.2.1.1) and Interfaces group (1.3.6.1.2.1.2).
 */

export const MIB2_OIDS = {
  /** Textual description of the entity (hardware, OS, networking software) */
  sysDescr: '1.3.6.1.2.1.1.1.0',
  /** Time (in hundredths of a second / TimeTicks) since the network management portion re-initialized */
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  /** Administratively-assigned name for this managed node (hostname) */
  sysName: '1.3.6.1.2.1.1.5.0',
  /** Physical location of this node (e.g. "Nodo Torre Norte - Gabinete B2") */
  sysLocation: '1.3.6.1.2.1.1.6.0',
  /** Interface 1 description (e.g. "ether1-wan" or "gpon-olt_1/1/1") */
  ifDescr1: '1.3.6.1.2.1.2.2.1.2.1',
  /** Interface 1 physical MAC address (6-octet binary hardware address) */
  ifPhysAddress1: '1.3.6.1.2.1.2.2.1.6.1',
  /** Interface 1 operational status (1=up, 2=down, 3=testing) */
  ifOperStatus1: '1.3.6.1.2.1.2.2.1.8.1',
  /** Total number of octets received on interface 1 (Counter32) */
  ifInOctets1: '1.3.6.1.2.1.2.2.1.10.1',
  /** Total number of octets transmitted out of interface 1 (Counter32) */
  ifOutOctets1: '1.3.6.1.2.1.2.2.1.16.1',
} as const;

export const DEFAULT_DIAGNOSTIC_OIDS: string[] = [
  MIB2_OIDS.sysName,
  MIB2_OIDS.sysDescr,
  MIB2_OIDS.sysUpTime,
  MIB2_OIDS.sysLocation,
  MIB2_OIDS.ifDescr1,
  MIB2_OIDS.ifPhysAddress1,
  MIB2_OIDS.ifOperStatus1,
  MIB2_OIDS.ifInOctets1,
  MIB2_OIDS.ifOutOctets1,
];

/**
 * Formats SNMP TimeTicks (hundredths of a second) into human-readable uptime:
 * e.g., "14d 06h 42m 18s (123,373,800 ticks)"
 */
export function formatSnmpTimeTicks(ticks: number): string {
  const totalSeconds = Math.floor(Math.max(0, ticks) / 100);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

