# Vagefisch — Acceptance Checklist

**Version:** 1.0  
**Status:** Source of Truth  
**Last Updated:** 2026-01-02

---

## How to Use This Checklist

This checklist is used to accept completed work **without reading code**. Each section corresponds to a functional area of the system. All items must be checked before work is accepted.

---

## Web UI

### Dashboard

- [ ] Dashboard displays OneBox connection status (✅ Online / ❌ Offline)
- [ ] Dashboard shows count of scales: Online / Offline
- [ ] Dashboard shows count of printers: Online / Offline
- [ ] Dashboard shows task queue: Active / Stuck
- [ ] Dashboard displays last 5-10 errors
- [ ] Dashboard loads without errors

### Navigation

- [ ] All tabs are visible: Dashboard, Scales, Printers, Routing, Queue/Tasks, Logs, Settings, Monitoring
- [ ] All tabs are clickable and navigate to correct pages
- [ ] No "Coming Soon" or placeholder pages

### General UI

- [ ] UI is readable without horizontal scrolling
- [ ] All buttons have visible feedback on click
- [ ] Loading states are shown during async operations
- [ ] Error messages are human-readable (not technical stack traces)

---

## Scales (Multi-Scale)

### Scale List

- [ ] Scales page shows a list/table of all configured scales
- [ ] Each scale shows: Name, Protocol, IP, Port, Status
- [ ] Status indicator: Online (green) / Offline (red) / Error (yellow)

### Scale Management

- [ ] "Add Scale" button is visible and functional
- [ ] Add form includes: Name, Protocol (SICS/IND), IP, Port
- [ ] "Edit" action available for each scale
- [ ] "Disable" action available for each scale
- [ ] "Delete" action available for each scale

### Scale Testing

- [ ] "Test Connection" button available for each scale
- [ ] Test shows success/failure result
- [ ] Last error message visible for scales with errors

### Multi-Scale Verification

- [ ] Can add 3+ scales without issues
- [ ] Each scale has independent status
- [ ] UI handles 10+ scales without performance issues

---

## OneBox Integration

### Configuration

- [ ] Settings page has OneBox section
- [ ] OneBox Base URL is configurable via UI
- [ ] OneBox API Token is configurable via UI
- [ ] OneBox Timeout is configurable via UI
- [ ] "Test Connection" button for OneBox

### Status

- [ ] OneBox connection status visible on Dashboard
- [ ] Connection errors are logged and visible

---

## Display Readability

### Scale Display Rules

- [ ] Documentation specifies max 3 lines for scale display
- [ ] Priority order documented: SKU → Plan → Name
- [ ] Language support documented: EN/DE only
- [ ] Fallback behavior documented for unsupported displays

### Implementation

- [ ] Task display respects 3-line limit
- [ ] SKU always visible (highest priority)
- [ ] Long product names are truncated
- [ ] No Cyrillic characters sent to scale displays

---

## Printers

### Printer List

- [ ] Printers page shows list/table of all configured printers
- [ ] Each printer shows: Name, IP, Port, Status
- [ ] Status indicator: Online (green) / Offline (red)

### Printer Management

- [ ] "Add Printer" button is visible and functional
- [ ] Add form includes: Name, IP, Port
- [ ] "Edit" action available for each printer
- [ ] "Delete" action available for each printer

### Printer Testing

- [ ] "Test Print" button available for each printer
- [ ] Test print produces output on physical printer
- [ ] Print errors are displayed in UI

### Print Queue

- [ ] Print queue visible for each printer
- [ ] Queue shows pending print jobs
- [ ] "Reprint" action available by task_id

---

## Monitoring

### Metrics Display

- [ ] Uptime metric visible
- [ ] Success rate metric visible
- [ ] Queue depth metric visible
- [ ] Offline devices count visible
- [ ] Average task duration visible

### Visualization

- [ ] Metrics are displayed in readable format
- [ ] Non-technical user can understand metrics
- [ ] Refresh/update mechanism works

---

## Telegram Alerts

### Configuration

- [ ] Settings page has Telegram section
- [ ] Bot Token is configurable via UI
- [ ] Chat ID is configurable via UI
- [ ] "Test Alert" button available

### Functionality

- [ ] Test alert sends message to configured chat
- [ ] Alert errors are displayed in UI
- [ ] Alerts sent for critical events (device offline, task failure)

---

## Queue / Tasks

### Task List

- [ ] Queue page shows all active tasks
- [ ] Each task shows: ID, Status, Scale, Duration
- [ ] Stuck tasks are highlighted (visual distinction)

### Task Actions

- [ ] "Cancel" action available for pending tasks
- [ ] "Retry" action available for failed tasks
- [ ] "Re-route" action available to move task to different scale

### Task Details

- [ ] Can view task details (SKU, weight, timestamps)
- [ ] Task history/log accessible

---

## Logs

### Log Display

- [ ] Logs page shows system logs
- [ ] Logs are in human-readable format
- [ ] Timestamps are visible and formatted

### Log Filtering

- [ ] Filter by task_id works
- [ ] Filter by scale works
- [ ] Filter by printer works
- [ ] Filter by severity (INFO/WARN/ERROR) works

### Log Export

- [ ] "Download Logs" button available
- [ ] Downloaded file contains filtered logs

---

## Settings

### OneBox Settings

- [ ] Base URL field
- [ ] API Token field
- [ ] Timeout field
- [ ] Save button with confirmation

### Telegram Settings

- [ ] Bot Token field
- [ ] Chat ID field
- [ ] Test Alert button
- [ ] Save button with confirmation

### General Settings

- [ ] Default unit field (kg/lb)
- [ ] Stabilization timeout field
- [ ] Retry count field
- [ ] Save button with confirmation

### Settings Persistence

- [ ] Settings are saved after page reload
- [ ] No config file editing required

---

## Security

### Access Control

- [ ] Web Admin Panel not exposed to public internet
- [ ] IP allow-list configurable (if implemented)

### Data Handling

- [ ] No sensitive data in browser console
- [ ] API tokens masked in UI

---

## Final Verification

- [ ] Curator can add a new scale without reading code
- [ ] Curator can view scale status without reading code
- [ ] Curator can see errors without reading code
- [ ] Curator can send test Telegram alert without reading code
- [ ] Curator can configure OneBox without editing files
- [ ] System works without internet connection (core functions)

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Architect | | | |
| Tester | | | |
| Curator | | | |
