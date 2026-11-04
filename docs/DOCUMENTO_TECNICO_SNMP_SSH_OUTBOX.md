# Documento Técnico de Ingeniería — Network Diagnostics Suite (TP6)

**Asignatura:** Desarrollo de Aplicaciones Móviles (2026) — Licenciatura en Sistemas de Información (FCyT - UADER)  
**Objeto:** Especificación técnica del subset del protocolo binario SNMP implementado (`BER/ASN.1`), arquitectura de resguardo criptográfico de credenciales SSH (`Keychain/Keystore` bajo OWASP MASVS) y diseño de la cola de sincronización diferida (`Outbox Pattern` sobre `WatermelonDB`).

---

## 1. Subset del Protocolo SNMP v1/v2c y Codec Binario ASN.1 / BER

### 1.1 Justificación Arquitectónica

En entornos React Native no existen librerías maduras y mantenidas que implementen el protocolo **Simple Network Management Protocol (SNMP, RFC 1157 / RFC 1905)** sin depender de extensiones nativas C++ de Node.js incompatibles con el runtime móvil (`Hermes`). Por ello, se diseñó un **codificador y decodificador binario propio desde cero** en el paquete `@network-suite/contracts` (`packages/contracts/src/snmp/berCodec.ts` y `pduBuilder.ts`), operando directamente sobre buffers `Uint8Array` transmitidos mediante datagramas `UDP/161` (`react-native-udp`).

### 1.2 Gramática Binaria ASN.1 BER (Tag-Length-Value) Implementada

Cada elemento del paquete SNMP se serializa utilizando la estructura **TLV (*Tag - Length - Value*)** definida en ITU-T X.690:

| Tag Hex | Tipo ASN.1 / SMI | Uso en Network Diagnostics Suite | Regla de Codificación |
| :--- | :--- | :--- | :--- |
| `0x02` | `INTEGER` | `version` (`0`=v1, `1`=v2c), `request-id`, `error-status`, `error-index`, `ifOperStatus` | Entero con signo en complemento a dos (Big-Endian). |
| `0x04` | `OCTET STRING` | `community` (`public`), `sysName`, `sysDescr`, `sysLocation`, `ifDescr`, `ifPhysAddress` (MAC de 6 octetos) | Secuencia de bytes crudos UTF-8 o dirección física binaria IEEE 802. |
| `0x05` | `NULL` | Valor placeholder en cada `VarBind` de un `GetRequest` | Longitud `0x00` (`05 00`). |
| `0x06` | `OBJECT IDENTIFIER` | Identificadores de objetos MIB-II (`1.3.6.1.2.1...`) | Primer octeto comprimido como $40 \times \text{arc}_0 + \text{arc}_1$ (`0x2B` para `1.3`). Sub-identificadores siguientes en base-128 de longitud variable con el bit 7 (`0x80`) como indicador de continuación. |
| `0x30` | `SEQUENCE` | Contenedor del mensaje SNMP, de la lista `VarBindList` y de cada par `VarBind` | Tipo construido que encapsula nodos TLV hijos secuenciales. |
| `0x41` | `Counter32` | Contadores de tráfico de interfaz `ifInOctets` y `ifOutOctets` | Entero sin signo de 32 bits monótonamente creciente. |
| `0x43` | `TimeTicks` | `sysUpTime` (centésimas de segundo desde el arranque del equipo) | Entero sin signo de 32 bits en unidades de $10\text{ ms}$. |
| `0xA0` | `GetRequest-PDU` | Solicitud de lectura enviada por la app móvil al puerto `UDP/161` | Context-specific explícito construido (`0xA0`). |
| `0xA2` | `GetResponse-PDU` | Respuesta emitida por el agente SNMP del equipo de red | Context-specific explícito construido (`0xA2`). |

### 1.3 Estructura de un Paquete SNMP `GetRequest` / `GetResponse`

```text
+-----------------------------------------------------------------------+
| 0x30 (SEQUENCE: SNMP Message)                                         |
|  +-- 0x02 (INTEGER: Version = 1 [SNMPv2c])                            |
|  +-- 0x04 (OCTET STRING: Community = "public")                        |
|  +-- 0xA0 / 0xA2 (PDU: GetRequest / GetResponse)                      |
|       +-- 0x02 (INTEGER: Request-ID)                                  |
|       +-- 0x02 (INTEGER: Error-Status = 0 [noError])                  |
|       +-- 0x02 (INTEGER: Error-Index = 0)                             |
|       +-- 0x30 (SEQUENCE: VarBindList)                                |
|            +-- 0x30 (SEQUENCE: VarBind #1)                            |
|            |    +-- 0x06 (OID: 1.3.6.1.2.1.1.5.0 [sysName])           |
|            |    +-- 0x05 (NULL en Request) / 0x04 (Valor en Response) |
|            +-- 0x30 (SEQUENCE: VarBind #N)                            |
+-----------------------------------------------------------------------+
```

### 1.4 Catálogo de OIDs MIB-II (RFC 1213) Soportados

1. `1.3.6.1.2.1.1.1.0` (`sysDescr`): Descripción de hardware, versión de sistema operativo y arquitectura del equipo.
2. `1.3.6.1.2.1.1.3.0` (`sysUpTime`): Tiempo en línea expresado en `TimeTicks` y formateado en `Xd Yh Zm Ws`.
3. `1.3.6.1.2.1.1.5.0` (`sysName`): Nombre administrativo del host/equipo.
4. `1.3.6.1.2.1.1.6.0` (`sysLocation`): Ubicación física del gabinete o nodo.
5. `1.3.6.1.2.1.2.2.1.2.1` (`ifDescr.1`): Nombre de la interfaz troncal principal.
6. `1.3.6.1.2.1.2.2.1.6.1` (`ifPhysAddress.1`): Dirección física MAC real de 6 bytes (resuelve la restricción de lectura de `/proc/net/arp` introducida en Android 10+).
7. `1.3.6.1.2.1.2.2.1.8.1` (`ifOperStatus.1`): Estado operativo del enlace (`1 = UP`, `2 = DOWN`).
8. `1.3.6.1.2.1.2.2.1.10.1` (`ifInOctets.1`): Total de octetos recibidos (RX).
9. `1.3.6.1.2.1.2.2.1.16.1` (`ifOutOctets.1`): Total de octetos transmitidos (TX).

### 1.5 Alcance y Limitaciones de Seguridad del Enfoque SNMPv1/v2c

* **Limitación:** Las versiones `SNMPv1` y `SNMPv2c` autentican las consultas mediante un *community string* enviado en texto claro dentro del datagrama UDP (`0x04 OCTET STRING`) y carecen de cifrado de carga útil o firma HMAC (`SNMPv3 USM`, RFC 3414).
* **Mitigación aplicada en campo:**
  1. La aplicación únicamente emite operaciones de **lectura (`GetRequest 0xA0`)** y bloquea por diseño la construcción de paquetes de escritura (`SetRequest 0xA3`).
  2. El *community string* utilizado debe corresponder a un perfil **Read-Only (RO)** restringido por ACL a la subred local de gestión del técnico.

---

## 2. Manejo Seguro de Credenciales SSH (OWASP MASVS-STORAGE)

Siguiendo la sección 4.2 del enunciado y el estándar **OWASP Mobile Application Security Verification Standard (MASVS-STORAGE-1 / MASVS-STORAGE-2)**:

1. **Prohibición de Texto Plano:** Ninguna contraseña SSH ni secreto de administración se almacena jamás en `AsyncStorage`, `WatermelonDB`, logs de consola ni payloads de la cola `Outbox`.
2. **Aislamiento en Hardware Keystore / iOS Keychain (`react-native-keychain`):**
   * En Android se utiliza `Android Keystore System` con cifrado simétrico `AES-256-GCM` respaldado por TEE (*Trusted Execution Environment*).
   * En iOS se utiliza `Keychain Services` con atributo de accesibilidad `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.
3. **Referencias Opacas (`serviceKey`):**
   * La base de datos local `WatermelonDB` y los reportes de diagnóstico únicamente persisten un identificador opaco de referencia (`keychain://ar.edu.uader.fcyt.nds/ssh/<deviceId>`) junto con el nombre de usuario y la IP del equipo.
4. **Comandos Predefinidos por Vendor (Prevención de Inyección):**
   * El cliente SSH embebido ejecuta exclusivamente plantillas cerradas de diagnóstico por fabricante (`MikroTik RouterOS`, `Huawei VRP`, `Ubiquiti AirOS`, `Cisco IOS`), evitando la ejecución accidental de comandos destructivos en equipos de producción.

---

## 3. Diseño de la Arquitectura Offline-First y Cola Outbox

### 3.1 Persistencia Local Reactiva (`WatermelonDB`)

El almacenamiento local se estructura en cuatro tablas principales indexadas (`apps/mobile/src/layers/store/localStore.ts`):
* `network_devices`: Inventario de equipos descubiertos en la LAN, indexado por `ip_address`, `mac_address` y `qr_barcode`.
* `diagnostic_logs`: Historial de ejecuciones SNMP, SSH y barridos LAN (`RF-08`).
* `installation_reports`: Reportes de instalación con coordenadas GPS WGS84, fotografías georreferenciadas y ruta al PDF compilado localmente (`RF-05`, `RF-06`).
* `outbox_queue`: Cola transaccional de operaciones pendientes de sincronización hacia el backend (`RF-07`).

### 3.2 Máquina de Estados del Patrón Outbox (`outboxEngine.ts`)

1. **`PENDING`:** Al registrar una instalación o diagnóstico, la entidad se guarda en `WatermelonDB` y en el mismo ciclo se inserta un registro en `outbox_queue` con un `idempotencyKey` único (`idem-<entityType>-<entityId>-<timestamp>`).
2. **`PROCESSING`:** Cuando `@react-native-community/netinfo` detecta conectividad activa (`isOnline = true`), el `OutboxSyncManager` selecciona los ítems elegibles en orden **FIFO** (`createdAt ASC`) y los envía a `POST /api/sync/outbox` incluyendo el header `Idempotency-Key`.
3. **`RETRY_SCHEDULED` (Backoff Exponencial):** Si ocurre un corte de señal o timeout HTTP 5xx, se incrementa `retryCount` y se calcula el próximo intento mediante:
   $$\text{delay}(\text{ms}) = \min\left(60000,\; 2000 \times 2^{\text{retryCount} - 1}\right)$$
4. **`CONFLICT_RESOLVED`:** Ante una respuesta `HTTP 409 Conflict`, el motor fusiona los metadatos remotos del servidor priorizando la evidencia fotográfica y GPS capturada por el técnico en campo (`FIELD_EVIDENCE_PRIORITY_MERGE`) y reenvía la operación.
5. **`DEAD_LETTER`:** Si `retryCount` alcanza `maxRetries` (5 intentos), el ítem queda aislado para revisión manual sin bloquear el resto de la cola.
6. **`SYNCED`:** Al recibir `HTTP 200/201` del backend, tanto el registro de la cola `Outbox` como el reporte/diagnóstico asociado se marcan como `SYNCED`.

