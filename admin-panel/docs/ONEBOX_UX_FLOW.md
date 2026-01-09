# OneBox ↔ Vagefisch: UX Flow

**Version:** 1.0.0  
**Last Updated:** 2026-01-09

---

## Обзор

Этот документ описывает пользовательский сценарий взвешивания товаров из OneBox CRM через Vagefisch Admin Panel.

---

## Архитектура

```
┌─────────────────┐     HTTP/REST      ┌─────────────────┐     SICS/TCP     ┌─────────────────┐
│                 │ ←───────────────── │                 │ ←───────────────→│                 │
│   OneBox CRM    │                    │   Vagefisch     │                  │   Mettler       │
│   (Frontend)    │ ───────────────→   │   Admin Panel   │ ───────────────→ │   Toledo Scale  │
│                 │                    │   (Node.js)     │                  │   (ICS/SICS)    │
└─────────────────┘                    └─────────────────┘                  └─────────────────┘
```

---

## Сценарий: Взвешивание позиции заказа

### Шаг 1: Оператор открывает заказ в OneBox

```
OneBox UI:
┌────────────────────────────────────────────────────────────────┐
│  Заказ #OBX-12345                                              │
├────────────────────────────────────────────────────────────────┤
│  Позиция 1: Lachsfilet Premium (SALM-001)                      │
│  Заказано: 12 box                                              │
│  Вес: [___________] kg   [🔄 Взвесить]                         │
├────────────────────────────────────────────────────────────────┤
│  Позиция 2: Forelle Filet (TROU-002)                           │
│  Заказано: 8 box                                               │
│  Вес: [___________] kg   [🔄 Взвесить]                         │
└────────────────────────────────────────────────────────────────┘
```

**Действие:** Оператор нажимает кнопку "Взвесить"

---

### Шаг 2: OneBox вызывает Vagefisch API

```javascript
// OneBox Frontend Code
const response = await fetch('http://192.168.1.74/api/weighing/start', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer vagefisch-api-token-2026',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    order_id: 'OBX-12345',
    line_id: 'LINE-1',
    product_name_de: 'Lachsfilet Premium',
    sku: 'SALM-001',
    ordered_qty: 12,
    qty_unit: 'box',
    scale_id: 'Waage-1',
    operator_id: currentUser.id
  })
});

const { session_id } = await response.json();
// session_id = "ws_20260109_123456"
```

**Результат:**
- Создается сессия взвешивания
- На дисплее весов появляется: `Lachsfilet | SALM-001`

---

### Шаг 3: OneBox показывает модальное окно взвешивания

```
OneBox UI (Modal):
┌────────────────────────────────────────────────────────────────┐
│                    🔄 Взвешивание                              │
│                                                                │
│  Продукт: Lachsfilet Premium (SALM-001)                        │
│  Заказано: 12 box                                              │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │                      5.234 kg                            │  │
│  │                      ● Стабильно                         │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Весы: Waage-1 (192.168.1.63)                                  │
│                                                                │
│  [Тара]  [Ноль]  [Отмена]              [✓ Подтвердить вес]     │
└────────────────────────────────────────────────────────────────┘
```

---

### Шаг 4: OneBox выполняет polling веса

```javascript
// OneBox Frontend - Polling Loop
const pollWeight = async () => {
  const response = await fetch(
    `http://192.168.1.74/api/weighing/${session_id}/live`,
    {
      headers: { 'Authorization': 'Bearer vagefisch-api-token-2026' }
    }
  );
  
  const data = await response.json();
  // data = { weight: 5.234, unit: "kg", stable: true, ... }
  
  updateUI(data.weight, data.unit, data.stable);
  
  if (data.status === 'RUNNING') {
    setTimeout(pollWeight, 500); // Poll every 500ms
  }
};

pollWeight();
```

---

### Шаг 5: Оператор подтверждает вес

**Действие:** Оператор нажимает "Подтвердить вес"

```javascript
// OneBox Frontend
const confirmResponse = await fetch(
  `http://192.168.1.74/api/weighing/${session_id}/confirm`,
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer vagefisch-api-token-2026',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tare_after: true })
  }
);

const result = await confirmResponse.json();
// result = { final_weight: 5.240, unit: "kg", confirmed_at: "..." }

// Записать вес в OneBox
await updateOrderLineWeight(orderId, lineId, result.final_weight);
```

---

### Шаг 6: OneBox обновляет заказ

```
OneBox UI:
┌────────────────────────────────────────────────────────────────┐
│  Заказ #OBX-12345                                              │
├────────────────────────────────────────────────────────────────┤
│  Позиция 1: Lachsfilet Premium (SALM-001)                      │
│  Заказано: 12 box                                              │
│  Вес: [5.240] kg ✓                     [🔄 Перевзвесить]       │
├────────────────────────────────────────────────────────────────┤
│  Позиция 2: Forelle Filet (TROU-002)                           │
│  Заказано: 8 box                                               │
│  Вес: [___________] kg                 [🔄 Взвесить]           │
└────────────────────────────────────────────────────────────────┘
```

---

## Дополнительные действия

### Тарирование

```javascript
// Оператор нажимает "Тара"
await fetch('http://192.168.1.74/api/scales/Waage-1/tare', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer vagefisch-api-token-2026' }
});
```

### Обнуление

```javascript
// Оператор нажимает "Ноль"
await fetch('http://192.168.1.74/api/scales/Waage-1/zero', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer vagefisch-api-token-2026' }
});
```

### Отмена

```javascript
// Оператор нажимает "Отмена"
await fetch(`http://192.168.1.74/api/weighing/${session_id}/cancel`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer vagefisch-api-token-2026' }
});
```

---

## Обработка ошибок

### Весы недоступны

```json
{
  "error": "SCALE_OFFLINE",
  "message": "Scale \"Waage-1\" is not responding"
}
```

**UI:** Показать сообщение "Весы недоступны. Проверьте подключение."

### Сессия истекла

```json
{
  "error": "SESSION_NOT_FOUND",
  "message": "Session \"ws_20260109_123456\" not found or expired"
}
```

**UI:** Показать сообщение "Сессия истекла. Начните взвешивание заново."

---

## Sequence Diagram

```
┌─────────┐          ┌─────────────┐          ┌───────────┐
│ OneBox  │          │  Vagefisch  │          │   Scale   │
│   UI    │          │    API      │          │  (SICS)   │
└────┬────┘          └──────┬──────┘          └─────┬─────┘
     │                      │                       │
     │ POST /weighing/start │                       │
     │─────────────────────>│                       │
     │                      │ D "Lachsfilet"        │
     │                      │──────────────────────>│
     │                      │       OK              │
     │                      │<──────────────────────│
     │ { session_id }       │                       │
     │<─────────────────────│                       │
     │                      │                       │
     │ GET /weighing/live   │                       │
     │─────────────────────>│                       │
     │                      │ SI                    │
     │                      │──────────────────────>│
     │                      │ S S 5.234 kg          │
     │                      │<──────────────────────│
     │ { weight: 5.234 }    │                       │
     │<─────────────────────│                       │
     │                      │                       │
     │  ... polling ...     │                       │
     │                      │                       │
     │ POST /weighing/confirm                       │
     │─────────────────────>│                       │
     │                      │ S                     │
     │                      │──────────────────────>│
     │                      │ S S 5.240 kg          │
     │                      │<──────────────────────│
     │                      │ TA                    │
     │                      │──────────────────────>│
     │                      │ T A                   │
     │                      │<──────────────────────│
     │ { final_weight: 5.240 }                      │
     │<─────────────────────│                       │
     │                      │                       │
```

---

## Таблицы БД

| Таблица | Описание |
|---------|----------|
| `scales` | Конфигурация весов (IP, порт, протокол) |
| `weighing_tasks` | Задачи взвешивания (сессии) |
| `events_log` | Лог всех событий (для аудита) |
| `routes` | Маршруты обработки |
| `route_steps` | Шаги маршрутов |

---

## Где смотреть ошибки

1. **PM2 Logs:**
   ```bash
   pm2 logs vagefisch-admin --lines 100
   ```

2. **Admin Panel → Журналы:**
   http://192.168.1.74/logs

3. **Admin Panel → Мониторинг:**
   http://192.168.1.74/monitoring

---

## Контакты

**Техническая поддержка:** WK Connect  
**Email:** support@wkconnect.de
