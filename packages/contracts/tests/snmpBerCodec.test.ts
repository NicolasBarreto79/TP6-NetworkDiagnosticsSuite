import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BerTag,
  buildSnmpGetRequestPacket,
  buildSnmpGetResponsePacket,
  decodeBerIntegerValue,
  decodeBerOidValue,
  decodeBerTlv,
   DEFAULT_DIAGNOSTIC_OIDS,
  encodeBerInteger,
  encodeBerLength,
  encodeBerOid,
  formatSnmpTimeTicks,
  macStringToBytes,
  mapSnmpResponseToTelemetry,
  MIB2_OIDS,
  parseSnmpPacket,
} from '../src/index.js';

describe('SNMP v1/v2c ASN.1 BER Binary Codec & PDU Builder (RF-02)', () => {
  it('encodes and decodes short and long BER lengths accurately', () => {
    const shortLen = encodeBerLength(45);
    assert.deepEqual(Array.from(shortLen), [45]);

    const longLen = encodeBerLength(300);
    // 300 = 0x012C -> [0x82, 0x01, 0x2C]
    assert.deepEqual(Array.from(longLen), [0x82, 0x01, 0x2c]);
  });

  it('encodes and decodes signed and unsigned BER integers', () => {
    const encodedPos = encodeBerInteger(49152);
    const tlvPos = decodeBerTlv(encodedPos);
    assert.equal(tlvPos.tag, BerTag.INTEGER);
    assert.equal(decodeBerIntegerValue(tlvPos.valueBytes), 49152);

    const encodedZero = encodeBerInteger(0);
    const tlvZero = decodeBerTlv(encodedZero);
    assert.equal(decodeBerIntegerValue(tlvZero.valueBytes), 0);
  });

  it('encodes and decodes MIB-II OIDs including base-128 multi-octet arcs', () => {
    const testOids = [
      MIB2_OIDS.sysDescr,
      MIB2_OIDS.sysUpTime,
      MIB2_OIDS.sysName,
      MIB2_OIDS.ifPhysAddress1,
      MIB2_OIDS.ifInOctets1,
      '1.3.6.1.4.1.14988.1.1.1.1.0', // MikroTik enterprise OID with multi-byte arc 14988
    ];

    for (const oid of testOids) {
      const encoded = encodeBerOid(oid);
      const tlv = decodeBerTlv(encoded);
      assert.equal(tlv.tag, BerTag.OBJECT_IDENTIFIER);
      const decoded = decodeBerOidValue(tlv.valueBytes);
      assert.equal(decoded, oid);
    }
  });

  it('builds a valid SNMPv2c GetRequest (0xA0) and decodes all requested OIDs', () => {
    const req = buildSnmpGetRequestPacket({
      community: 'public',
      oids: DEFAULT_DIAGNOSTIC_OIDS,
      requestId: 774123,
      version: 'v2c',
    });

    assert.ok(req.buffer.length > 40);
    const parsed = parseSnmpPacket(req.buffer);
    assert.equal(parsed.version, 'v2c');
    assert.equal(parsed.community, 'public');
    assert.equal(parsed.pduType, BerTag.GET_REQUEST_PDU);
    assert.equal(parsed.requestId, 774123);
    assert.equal(parsed.varBinds.length, DEFAULT_DIAGNOSTIC_OIDS.length);
    assert.deepEqual(
      parsed.varBinds.map((vb) => vb.oid),
      DEFAULT_DIAGNOSTIC_OIDS
    );
  });

  it('builds and parses an SNMPv2c GetResponse (0xA2) into a full SnmpTelemetrySnapshot', () => {
    const requestId = 551902;
    const responsePacket = buildSnmpGetResponsePacket({
      community: 'public',
      requestId,
      version: 'v2c',
      varBinds: [
        {
          oid: MIB2_OIDS.sysName,
          typeTag: BerTag.OCTET_STRING,
          value: 'MK-CCR2004-NODO-CENTRO',
        },
        {
          oid: MIB2_OIDS.sysDescr,
          typeTag: BerTag.OCTET_STRING,
          value: 'RouterOS CCR2004-16G-2S+ v7.14.2',
        },
        {
          oid: MIB2_OIDS.sysUpTime,
          typeTag: BerTag.TIMETICKS,
          value: 123373800,
        },
        {
          oid: MIB2_OIDS.sysLocation,
          typeTag: BerTag.OCTET_STRING,
          value: 'Torre Principal CDU - Rack A1',
        },
        {
          oid: MIB2_OIDS.ifDescr1,
          typeTag: BerTag.OCTET_STRING,
          value: 'sfp-sfpplus1-uplink',
        },
        {
          oid: MIB2_OIDS.ifPhysAddress1,
          typeTag: BerTag.OCTET_STRING,
          value: '',
          rawBytes: macStringToBytes('DC:2C:6E:4A:11:01'),
        },
        {
          oid: MIB2_OIDS.ifOperStatus1,
          typeTag: BerTag.INTEGER,
          value: 1,
        },
        {
          oid: MIB2_OIDS.ifInOctets1,
          typeTag: BerTag.COUNTER32,
          value: 984120500,
        },
        {
          oid: MIB2_OIDS.ifOutOctets1,
          typeTag: BerTag.COUNTER32,
          value: 412890100,
        },
      ],
    });

    const parsed = parseSnmpPacket(responsePacket.buffer);
    assert.equal(parsed.pduType, BerTag.GET_RESPONSE_PDU);
    assert.equal(parsed.requestId, requestId);

    const snapshot = mapSnmpResponseToTelemetry({
      targetIp: '192.168.1.1',
      port: 161,
      roundTripMs: 14,
      rawRequestHex: '30 29 02 01 01',
      parsedResponse: parsed,
    });

    assert.equal(snapshot.sysName, 'MK-CCR2004-NODO-CENTRO');
    assert.equal(snapshot.sysUpTimeFormatted, formatSnmpTimeTicks(123373800));
    assert.equal(snapshot.interfaces[0].ifPhysAddressMac, 'DC:2C:6E:4A:11:01');
    assert.equal(snapshot.interfaces[0].ifOperStatus, 'UP');
    assert.equal(snapshot.interfaces[0].ifInOctets, 984120500);
    assert.equal(snapshot.interfaces[0].ifOutOctets, 412890100);
  });
});

