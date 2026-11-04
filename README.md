# TP6 — Network Diagnostics Suite

**Licenciatura en Sistemas de Información — Desarrollo de Aplicaciones Móviles (2026)**  
**Facultad de Ciencia y Tecnología (FCyT) — UADER (Sede Concepción del Uruguay)**

Toolkit móvil *offline-first* en React Native para técnicos de campo que instalan, diagnostican y auditan infraestructura de telecomunicaciones (**ONTs GPON, routers de borde, antenas PtP y switches**) en sitios con conectividad nula o intermitente.

---

## 1. Arquitectura de 6 Capas y Monorepo

El sistema implementa estrictamente las **6 capas de dominio** especificadas por la cátedra y se organiza en un monorepo TypeScript modular:

| Capa Arquitectónica | Responsabilidad Principal | Implementación en el Proyecto |
| :--- | :--- | :--- |
| **1. Discovery Layer** | Escaneo de LAN vía `mDNS/Bonjour` y barrido activo de subred con sonda SNMP inicial automática (`«include»`) | `apps/mobile/src/layers/discovery/discoveryLayer.ts` |
| **2. Protocol Layer** | Cliente binario **SNMP v1/v2c (`ASN.1 / BER`)** sobre `UDP/161`, cliente **SSH** sobre `TCP/22` y bóveda **Keychain/Keystore** | `packages/contracts/src/snmp/` + `apps/mobile/src/layers/protocol/protocolLayer.ts` |
| **3. Evidence Layer** | Escaneo de códigos QR/barras vinculado a fichas técnicas, captura fotográfica y geolocalización GPS WGS84 | `apps/mobile/src/layers/evidence/evidenceLayer.ts` |
| **4. Local Store** | Persistencia reactiva *offline-first* de equipos, diagnósticos, reportes y cola de salida en **WatermelonDB** | `apps/mobile/src/layers/store/localStore.ts` |
| **5. Sync Layer** | Cola de sincronización diferida (**Patrón Outbox**) con `@react-native-community/netinfo`, backoff exponencial e idempotencia | `packages/contracts/src/outbox/` + `apps/mobile/src/layers/sync/syncLayer.ts` |
| **6. Reporting Layer** | Compilación local de reportes técnicos de instalación en **PDF** con fotos georreferenciadas y telemetría SNMP/SSH | `packages/contracts/src/pdf/` + `apps/mobile/src/layers/reporting/reportingLayer.ts` |

### Estructura de Paquetes

* `packages/contracts` (`@network-suite/contracts`): Modelos tipados, codificador/decodificador binario **ASN.1 BER (`TLV`)** para PDUs `GetRequest (0xA0)` y `GetResponse (0xA2)`, catálogo **MIB-II** (RFC 1213), perfiles de comandos SSH por fabricante, motor de estados **Outbox** y generador HTML/PDF.
* `apps/backend` (`@network-suite/backend`): Servidor HTTP de sincronización diferida (`POST /api/sync/outbox`, catálogo de fichas técnicas QR `/api/datasheets/:code`) + **Agente SNMP v2c UDP real (`UDP/1610`)** sobre `node:dgram` que intercambia paquetes binarios `ASN.1 BER` reales simulando 4 equipos de red en la LAN (`MikroTik CCR2004`, `Huawei EchoLife HG8245Q2`, `Ubiquiti PowerBeam 5AC Gen2`, `Cisco Catalyst 2960-X`).
* `apps/mobile` (`@network-suite/mobile`): Aplicación móvil React Native con interfaz **Industrial Light Mode**, navegación vectorial SVG y operación 100% *offline-first*.

---

## 2. Matriz de Cumplimiento de Requisitos Funcionales (`RF-01` a `RF-08`)

| ID | Requisito Funcional | Prioridad | Estado | Módulo / Verificación |
| :--- | :--- | :---: | :---: | :--- |
| **RF-01** | Escanear la red local y listar dispositivos activos (IP, MAC, hostname) + `«include»` sonda SNMP inicial | Alta | Cumplido | `LanDiscoveryScreen.tsx` / `discoveryLayer.ts` |
| **RF-02** | Consultar vía SNMP (`UDP/161`): `sysUpTime`, `sysName`, `ifPhysAddress` y tráfico de interfaces (`ifInOctets` / `ifOutOctets`) con parser propio `BER/ASN.1` | Alta | Cumplido | `DiagnosticsConsoleScreen.tsx` / `berCodec.ts` / `pduBuilder.ts` |
| **RF-03** | Conectarse vía SSH a un equipo y ejecutar comandos de diagnóstico predefinidos resguardando credenciales en `Keychain/Keystore` | Alta | Cumplido | `DiagnosticsConsoleScreen.tsx` / `vendorCommands.ts` / `protocolLayer.ts` |
| **RF-04** | Escanear código QR/barras de un equipo y asociarlo a su ficha técnica remota o en caché local | Media | Cumplido | `InstallationReportScreen.tsx` / `evidenceLayer.ts` |
| **RF-05** | Registrar una instalación con fotos, ubicación GPS WGS84 y notas técnicas | Alta | Cumplido | `InstallationReportScreen.tsx` / `evidenceLayer.ts` |
| **RF-06** | Generar un reporte PDF de instalación localmente a partir de los datos registrados (`«include»`) | Media | Cumplido | `reportingLayer.ts` / `reportTemplate.ts` |
| **RF-07** | Operar completamente offline y encolar acciones (`Outbox Pattern`) para sincronizar automáticamente al recuperar conectividad (`NetInfo`) | Alta | Cumplido | `OutboxSyncScreen.tsx` / `syncLayer.ts` / `outboxEngine.ts` |
| **RF-08** | Historial de diagnósticos y reportes por equipo/sitio consultable sin conexión | Media | Cumplido | `HistoryScreen.tsx` / `localStore.ts` |

---

## 3. Instalación, Ejecución y Pruebas Automatizadas

### 3.1 Instalación de Dependencias

```bash
npm install
```

### 3.2 Ejecución de la Suite de Pruebas Automatizadas (Unitarias + Integración UDP/HTTP + Capas Móviles)

```bash
npm test
```

* `npm run test:contracts`: Valida el codificador/decodificador binario `ASN.1 BER`, compresión de OIDs en base-128, armado/parseo de PDUs `SNMPv2c`, máquina de estados `Outbox` con backoff exponencial y plantillas PDF.
* `npm run test:backend`: Levanta el **Agente SNMP v2c UDP real** en un socket `udp4` y el servidor HTTP de sincronización, verificando el intercambio de tramas binarias `BER` reales y la ingesta idempotente del `Outbox`.
* `npm run test:mobile`: Verifica de extremo a extremo las 6 capas de la aplicación móvil cubriendo `RF-01` a `RF-08` (incluyendo corte de conectividad, operación 100% offline, generación de PDF y sincronización automática al reconectar).

### 3.3 Levantar el Entorno Completo en Vivo

1. **Iniciar el Backend de Sincronización + Agente SNMP v2c UDP Real (Puerto HTTP `3000` / Puerto UDP `1610`):**
   ```bash
   npm run start:backend
   ```
2. **Iniciar la Aplicación Móvil (`@network-suite/mobile`):**
   ```bash
   npm run web
   ```
3. **Compilación de Build Nativo Android (APK fuera de Expo Go):**
   ```bash
   cd apps/mobile
   npx expo run:android --variant release
   ```

---

## 4. Documentación Técnica Adicional

* **[Documento Técnico Oficial (SNMP BER/ASN.1, Seguridad SSH Keychain y Cola Outbox)](./docs/DOCUMENTO_TECNICO_SNMP_SSH_OUTBOX.md)**

