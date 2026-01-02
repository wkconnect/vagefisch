# Vagefisch — Architecture Document

**Version:** 1.0  
**Status:** Source of Truth  
**Last Updated:** 2026-01-02

---

## 1. Goal & Scope

**Vagefisch** is an on-premises production weighing system designed to integrate industrial scales with the OneBox CRM system. The system enables automated weighing workflows in manufacturing environments, providing real-time data synchronization between weighing devices and enterprise resource planning.

### Primary Objectives

- Provide reliable, offline-capable weighing operations for production environments
- Integrate Mettler Toledo industrial scales with OneBox CRM
- Enable multi-scale concurrent operations with task queuing
- Support label printing for weighed products
- Deliver real-time monitoring and alerting capabilities

### Out of Scope

- Cloud-based or SaaS deployment models
- External webhook integrations
- Third-party scale manufacturers (initial release)
- Mobile applications

---

## 2. Environment & Infrastructure

### Deployment Model

Vagefisch operates exclusively as an **on-premises (on-prem)** solution. All components run within the customer's local network infrastructure.

### Infrastructure Components

| Component | Deployment | Description |
|-----------|------------|-------------|
| **OneBox CRM** | Dedicated VM | Boxed (коробочная) version of OneBox, self-hosted on customer infrastructure |
| **Vagefisch Connector** | Separate VM | Core runtime service handling scale communication and business logic |
| **Network Scales** | LAN Devices | Mettler Toledo ICS/IND series connected via Ethernet |
| **Network Printers** | LAN Devices | Label printers for product identification |

### Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Customer LAN                              │
│                                                              │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────┐ │
│  │   OneBox     │◄──►│    Vagefisch     │◄──►│  Scales   │ │
│  │   CRM VM     │    │   Connector VM   │    │  (1..N)   │ │
│  └──────────────┘    └──────────────────┘    └───────────┘ │
│                              │                              │
│                              ▼                              │
│                      ┌───────────┐                         │
│                      │ Printers  │                         │
│                      │  (1..N)   │                         │
│                      └───────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### Critical Requirement: Offline Operation

The weighing system **MUST** continue operating even when internet connectivity is lost. All core weighing, printing, and local data storage functions operate independently of external network access.

---

## 3. Core Components

### 3.1 Connector Runtime

The Connector Runtime is the central service responsible for:

- **Scale Communication:** Establishing and maintaining connections with all configured scales
- **Protocol Handling:** Implementing MT-SICS and IND protocols for Mettler Toledo devices
- **Task Management:** Processing weighing tasks from OneBox, managing queues per scale
- **Data Synchronization:** Sending weighing results back to OneBox CRM
- **Print Orchestration:** Generating and sending print jobs to configured printers

### 3.2 Web Admin Panel

The Web Admin Panel provides a browser-based interface for system administration:

| Tab | Purpose |
|-----|---------|
| **Dashboard** | System overview: device status, queue depth, recent errors |
| **Scales** | Configure, monitor, and test scale connections |
| **Printers** | Configure, monitor, and test printer connections |
| **Routing** | Define task routing rules between scales |
| **Queue / Tasks** | View active tasks, retry failed tasks, cancel stuck operations |
| **Logs** | Searchable, filterable system logs |
| **Settings** | OneBox, Telegram, and general system configuration |
| **Monitoring** | Performance metrics, uptime, success rates |

### 3.3 Monitoring & Alerts

The monitoring subsystem provides:

- **Health Checks:** Periodic verification of scale and printer connectivity
- **Metrics Collection:** Task duration, success rates, queue depths
- **Telegram Alerts:** Real-time notifications for critical events (device offline, task failures)
- **Log Aggregation:** Centralized logging with severity levels (INFO, WARN, ERROR)

---

## 4. Supported Devices

### 4.1 Scales — Mettler Toledo

| Series | Protocol | Connection | Status |
|--------|----------|------------|--------|
| **ICS** (ICS429, ICS449, etc.) | MT-SICS | TCP/IP | Supported |
| **IND** (IND131, IND231, etc.) | IND Protocol | TCP/IP | Supported |

### 4.2 Base Protocol: MT-SICS

**MT-SICS (Mettler Toledo Standard Interface Command Set)** is the primary communication protocol:

- Text-based command/response protocol
- Commands for: tare, zero, read weight, stability check
- Supports both immediate and stable weight readings
- Error handling with standardized response codes

### 4.3 IND Protocol Extensions

For IND series terminals, additional protocol features include:

- Extended display control
- Custom message display
- Transaction-based weighing workflows

### 4.4 Printers

Network label printers supporting standard protocols:

- Raw TCP socket printing
- ZPL (Zebra Programming Language) compatible
- Direct text output for simple labels

---

## 5. Data Flow

### Primary Weighing Workflow

```
┌─────────┐      ┌───────────┐      ┌─────────┐      ┌───────────┐      ┌─────────┐
│ OneBox  │─────►│ Connector │─────►│  Scale  │─────►│ Connector │─────►│ OneBox  │
│  CRM    │ (1)  │  Runtime  │ (2)  │ Device  │ (3)  │  Runtime  │ (4)  │  CRM    │
└─────────┘      └───────────┘      └─────────┘      └───────────┘      └─────────┘
     │                                                      │
     │                                                      ▼
     │                                               ┌───────────┐
     │                                               │  Printer  │
     │                                               │  (label)  │
     │                                               └───────────┘
     │                                                      │
     └──────────────────────────────────────────────────────┘
                              (5) Confirmation
```

### Flow Steps

| Step | Direction | Description |
|------|-----------|-------------|
| **(1)** | OneBox → Connector | Task creation: SKU, target weight, product info |
| **(2)** | Connector → Scale | Display task info, request weight reading |
| **(3)** | Scale → Connector | Return stable weight value |
| **(4)** | Connector → OneBox | Report weighing result, update inventory |
| **(5)** | Connector → Printer | Generate and print product label |

### Data Persistence

- **Task Queue:** Persisted locally on Connector VM
- **Weighing Results:** Stored locally until confirmed by OneBox
- **Configuration:** Stored in local database, editable via Web Admin Panel

---

## 6. Scale Display UX & Readability

### Display Constraints

Industrial scale displays have limited screen real estate. The following rules ensure readability:

### Rule 1: Maximum 3 Lines

All scale display messages are limited to **3 lines maximum**. This ensures visibility from operator distance.

### Rule 2: Content Priority

When space is limited, content is prioritized in this order:

| Priority | Content | Example |
|----------|---------|---------|
| **1** | SKU / Article Number | `SKU: 12345-A` |
| **2** | Target Weight (Plan) | `Plan: 5.000 kg` |
| **3** | Product Name (truncated) | `Chicken Brea...` |

### Rule 3: Language Support

- **Supported Languages:** English (EN), German (DE)
- **No Cyrillic:** Scale displays typically do not support Cyrillic characters
- **ASCII-safe:** All display text must be ASCII-compatible

### Rule 4: Fallback Behavior

If the scale display does not support text rendering:

1. Display numeric codes only (SKU as numbers)
2. Use LED indicators for status (if available)
3. Rely on Web Admin Panel for full task details

### Display Format Example

```
Line 1: SKU: 12345-A
Line 2: Plan: 5.000 kg
Line 3: Chicken Breast
```

---

## 7. Multi-Scale Architecture

### Design Principle

Vagefisch is designed from the ground up to support **1 to N scales** operating concurrently. Single-scale operation is merely a special case of multi-scale architecture.

### Per-Scale Queue

Each scale maintains its own independent task queue:

```
Scale A Queue: [Task 1] → [Task 2] → [Task 3]
Scale B Queue: [Task 4] → [Task 5]
Scale C Queue: [Task 6] → [Task 7] → [Task 8] → [Task 9]
```

### Lock Per Scale

**Critical Rule:** Each scale can process exactly **one active task** at a time.

| Scale | Active Task | Queue |
|-------|-------------|-------|
| Scale A | Task 1 (in progress) | Task 2, Task 3 |
| Scale B | Task 4 (in progress) | Task 5 |
| Scale C | Task 6 (in progress) | Task 7, Task 8, Task 9 |

### Task Routing

Tasks can be routed to scales based on:

- **Manual Assignment:** Operator selects target scale
- **Round-Robin:** Automatic distribution across available scales
- **Capacity-Based:** Route to scale with shortest queue

### Task Re-Routing

If a scale goes offline, pending tasks can be re-routed to another available scale via the Web Admin Panel.

---

## 8. Printers & Printing Flow

### Printer Architecture

Printers are treated as first-class devices, similar to scales:

- Each printer has a unique configuration (Name, IP, Port)
- Printers have online/offline status monitoring
- Print jobs are queued per printer

### Printing Flow

```
┌───────────┐      ┌───────────┐      ┌───────────┐
│ Weighing  │─────►│   Print   │─────►│  Printer  │
│ Complete  │      │   Queue   │      │  Device   │
└───────────┘      └───────────┘      └───────────┘
```

### Print Job Lifecycle

| State | Description |
|-------|-------------|
| **Pending** | Job created, waiting in queue |
| **Printing** | Job sent to printer |
| **Completed** | Printer acknowledged receipt |
| **Failed** | Print error, requires retry |

### Reprint Capability

The Web Admin Panel supports reprinting by `task_id`:

1. Locate task in Queue/Tasks or Logs
2. Click "Reprint" button
3. Select target printer
4. Confirm reprint

---

## 9. Security Model

### Network Security

| Principle | Implementation |
|-----------|----------------|
| **LAN Only** | All communication occurs within customer's local network |
| **No Internet Required** | Core operations function without external connectivity |
| **No SaaS** | No cloud services, no external data storage |
| **No External Webhooks** | No outbound HTTP callbacks to external services |

### Access Control

| Control | Description |
|---------|-------------|
| **IP Allow-List** | Web Admin Panel access restricted to configured IP ranges |
| **Network Segmentation** | Scales and printers can be isolated on dedicated VLAN |
| **No Public Exposure** | Connector services are never exposed to public internet |

### Data Security

- All configuration stored locally on Connector VM
- No sensitive data transmitted externally
- Weighing data retained only as long as required by OneBox

---

## 10. Non-Negotiables

The following architectural decisions are **fixed** and cannot be changed without explicit approval from the Project Architect:

### Infrastructure

- ❌ **No SaaS deployment** — Vagefisch remains on-premises only
- ❌ **No cloud dependencies** — All services run locally
- ❌ **No external webhooks** — No outbound calls to external services

### Device Support

- ❌ **No single-scale assumption** — Architecture must always support N scales
- ❌ **No hardcoded device limits** — System scales with customer needs

### Protocol

- ❌ **No protocol simplification** — MT-SICS and IND protocols implemented as specified
- ❌ **No polling shortcuts** — Proper connection management required

### Configuration

- ❌ **No config-file-only settings** — All settings accessible via Web Admin Panel
- ❌ **No hidden parameters** — Curators must be able to manage system without code access

### User Experience

- ❌ **No developer-only UI** — Interface designed for non-technical curators
- ❌ **No incomplete tabs** — All navigation elements functional (stubs acceptable during development)

### Process

- ❌ **No "we'll add it later"** — Features either complete or explicitly deferred
- ❌ **No undocumented changes** — All modifications tracked in version control

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-02 | Architecture Team | Initial release |
