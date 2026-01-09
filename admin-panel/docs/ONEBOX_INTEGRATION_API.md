# OneBox ↔ Vagefisch Integration API

**Version:** 1.0.0  
**Last Updated:** 2026-01-09  
**Base URL:** `http://192.168.1.74/api`

---

## Авторизация

Все запросы требуют Bearer Token в заголовке:

```
Authorization: Bearer vagefisch-api-token-2026
```

**Пример:**
```bash
curl -H "Authorization: Bearer vagefisch-api-token-2026" \
     http://192.168.1.74/api/scales
```

---

## Endpoints

### 1. Weighing Session API

#### 1.1 Start Weighing Session

Начать сессию взвешивания для позиции заказа.

```
POST /api/weighing/start
```

**Request Body:**
```json
{
  "order_id": "OBX-12345",
  "line_id": "LINE-7",
  "product_name_de": "Lachsfilet Premium",
  "sku": "SALM-001",
  "ordered_qty": 12,
  "qty_unit": "box",
  "scale_id": "Waage-1",
  "operator_id": "user-77",
  "meta": {
    "onebox_url": "https://crm.../deal/123",
    "warehouse": "PROD"
  }
}
```

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| order_id | string | ✅ | ID заказа в OneBox |
| line_id | string | ❌ | ID строки заказа |
| product_name_de | string | ❌ | Название продукта (DE) |
| sku | string | ❌ | Артикул |
| ordered_qty | number | ❌ | Заказанное количество |
| qty_unit | string | ❌ | Единица измерения (default: "pcs") |
| scale_id | string | ✅ | Имя весов (из /api/scales) |
| operator_id | string | ❌ | ID оператора |
| meta | object | ❌ | Дополнительные данные |

**Response (200 OK):**
```json
{
  "session_id": "ws_20260109_000123",
  "status": "STARTED",
  "scale_id": "Waage-1",
  "display_text_sent": true
}
```

**Что происходит:**
1. Создается сессия взвешивания
2. На дисплей весов отправляется текст: `{product_name_de} | {sku} | {ordered_qty} {qty_unit}`
3. Запускается polling веса каждые 500ms

---

#### 1.2 Get Live Weight (Polling)

Получить текущий вес в реальном времени.

```
GET /api/weighing/{session_id}/live
```

**Response (200 OK):**
```json
{
  "session_id": "ws_20260109_000123",
  "status": "RUNNING",
  "weight": 5.234,
  "unit": "kg",
  "stable": true,
  "raw": "S S  5.234 kg",
  "ts": "2026-01-09T12:44:12Z"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| session_id | string | ID сессии |
| status | string | STARTED / RUNNING / CONFIRMED / CANCELLED |
| weight | number | Текущий вес |
| unit | string | Единица измерения (kg, g, lb) |
| stable | boolean | Вес стабилен |
| raw | string | Сырой ответ SICS |
| ts | string | Timestamp (ISO 8601) |

**Рекомендуемый интервал polling:** 300-500ms

---

#### 1.3 Confirm Weighing

Подтвердить и зафиксировать итоговый вес.

```
POST /api/weighing/{session_id}/confirm
```

**Request Body:**
```json
{
  "action": "CONFIRM",
  "tare_after": true
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| action | string | "CONFIRM" (опционально) |
| tare_after | boolean | Выполнить тарирование после подтверждения |

**Response (200 OK):**
```json
{
  "session_id": "ws_20260109_000123",
  "status": "CONFIRMED",
  "final_weight": 5.240,
  "unit": "kg",
  "confirmed_at": "2026-01-09T12:45:01Z"
}
```

**Важно:** `final_weight` — это значение, которое нужно записать в OneBox.

---

#### 1.4 Cancel Weighing

Отменить сессию взвешивания.

```
POST /api/weighing/{session_id}/cancel
```

**Response (200 OK):**
```json
{
  "session_id": "ws_20260109_000123",
  "status": "CANCELLED",
  "cancelled_at": "2026-01-09T12:46:00Z"
}
```

---

### 2. Scale Control API

#### 2.1 Tare Scale

Установить тару (обнулить с учетом тары).

```
POST /api/scales/{scale_id}/tare
```

**Request Body (опционально):**
```json
{
  "value": 0
}
```

**Response (200 OK):**
```json
{
  "scale_id": "Waage-1",
  "action": "TARE",
  "success": true,
  "value": 0,
  "ts": "2026-01-09T12:47:00Z"
}
```

---

#### 2.2 Zero Scale

Обнулить весы (установить ноль).

```
POST /api/scales/{scale_id}/zero
```

**Response (200 OK):**
```json
{
  "scale_id": "Waage-1",
  "action": "ZERO",
  "success": true,
  "ts": "2026-01-09T12:47:30Z"
}
```

---

#### 2.3 Display Text

Вывести текст на дисплей весов.

```
POST /api/scales/{scale_id}/display
```

**Request Body:**
```json
{
  "text": "Lachsfilet | SALM-001 | 12 box"
}
```

**Ограничение:** максимум 20 символов (SICS протокол).

**Response (200 OK):**
```json
{
  "scale_id": "Waage-1",
  "action": "DISPLAY",
  "success": true,
  "text": "Lachsfilet | SALM-00",
  "ts": "2026-01-09T12:48:00Z"
}
```

---

#### 2.4 Get Scale Status

Получить статус весов.

```
GET /api/scales/{scale_id}/status
```

**Response (200 OK):**
```json
{
  "scale_id": "Waage-1",
  "online": true,
  "last_seen": "2026-01-09T12:44:12Z",
  "last_error": null,
  "last_weight": 5.234,
  "last_unit": "kg"
}
```

---

### 3. Scales CRUD API

#### 3.1 List Scales

```
GET /api/scales
```

**Response (200 OK):**
```json
{
  "scales": [
    {
      "id": 1,
      "name": "Waage-1",
      "type": "SICS",
      "ip": "192.168.1.63",
      "port": 4306,
      "online": true,
      "last_seen": "2026-01-09T12:44:12Z"
    }
  ]
}
```

---

#### 3.2 Create Scale

```
POST /api/scales
```

**Request Body:**
```json
{
  "name": "Waage-2",
  "type": "SICS",
  "ip": "192.168.1.64",
  "port": 4305
}
```

---

#### 3.3 Update Scale

```
PATCH /api/scales/{id}
```

**Request Body:**
```json
{
  "name": "Waage-2-Updated",
  "ip": "192.168.1.65"
}
```

---

#### 3.4 Delete Scale

```
DELETE /api/scales/{id}
```

---

## Коды ошибок

| HTTP Code | Error Code | Описание |
|-----------|------------|----------|
| 400 | BAD_REQUEST | Отсутствуют обязательные поля |
| 401 | UNAUTHORIZED | Неверный или отсутствующий токен |
| 404 | SCALE_NOT_FOUND | Весы не найдены |
| 404 | SESSION_NOT_FOUND | Сессия не найдена или истекла |
| 409 | ALREADY_CONFIRMED | Сессия уже подтверждена |
| 409 | ALREADY_EXISTS | Весы с таким именем уже существуют |
| 410 | SESSION_CLOSED | Сессия закрыта (confirmed/cancelled) |
| 410 | SESSION_CANCELLED | Сессия была отменена |
| 503 | SCALE_OFFLINE | Весы недоступны |
| 503 | SCALE_ERROR | Ошибка связи с весами |
| 500 | INTERNAL_ERROR | Внутренняя ошибка сервера |

**Пример ошибки:**
```json
{
  "error": "SCALE_NOT_FOUND",
  "message": "Scale \"Waage-99\" not found"
}
```

---

## Таймауты

| Операция | Таймаут |
|----------|---------|
| Подключение к весам | 5 секунд |
| Чтение веса | 3 секунды |
| Команды (tare/zero/display) | 5 секунд |
| Сессия без активности | 5 минут |

---

## curl Примеры

### Полный цикл взвешивания

```bash
# 1. Начать сессию
curl -X POST \
  -H "Authorization: Bearer vagefisch-api-token-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "OBX-12345",
    "line_id": "LINE-1",
    "product_name_de": "Lachsfilet Premium",
    "sku": "SALM-001",
    "ordered_qty": 12,
    "qty_unit": "box",
    "scale_id": "Waage-1",
    "operator_id": "user-1"
  }' \
  http://192.168.1.74/api/weighing/start

# Response: {"session_id":"ws_20260109_123456",...}

# 2. Polling веса (каждые 500ms)
curl -H "Authorization: Bearer vagefisch-api-token-2026" \
  http://192.168.1.74/api/weighing/ws_20260109_123456/live

# Response: {"weight":5.234,"stable":true,...}

# 3. Подтвердить вес
curl -X POST \
  -H "Authorization: Bearer vagefisch-api-token-2026" \
  -H "Content-Type: application/json" \
  -d '{"tare_after": true}' \
  http://192.168.1.74/api/weighing/ws_20260109_123456/confirm

# Response: {"final_weight":5.240,...}
```

### Управление весами

```bash
# Обнулить весы
curl -X POST \
  -H "Authorization: Bearer vagefisch-api-token-2026" \
  http://192.168.1.74/api/scales/Waage-1/zero

# Тарировать
curl -X POST \
  -H "Authorization: Bearer vagefisch-api-token-2026" \
  http://192.168.1.74/api/scales/Waage-1/tare

# Вывести текст на дисплей
curl -X POST \
  -H "Authorization: Bearer vagefisch-api-token-2026" \
  -H "Content-Type: application/json" \
  -d '{"text": "Salmon 12 box"}' \
  http://192.168.1.74/api/scales/Waage-1/display
```

---

## Контакты

**Техническая поддержка:** WK Connect  
**Email:** support@wkconnect.de
