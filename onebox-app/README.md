# OneBox vagefisch app (deployed-only mirror)

Эти файлы — кастомное OneBox-приложение `vagefisch` (PHP), которое НЕ хранится в основном
репозитории OneBox, а живёт на инстансах (demo VM 140, prod portal). Здесь — их зеркало/бэкап.

Путь на инстансе: `/var/www/<inst>/web1/web/apps/vagefisch/`

## Ключевая логика
- `api/VagefischService.class.php` — HTTP-клиент к admin-panel API. **Hardening 2026-07-04:** конструктор
  сам добавляет `/api/v1` к base-url (если не задан) — иначе запросы попадают на SPA-fallback → 400.
- `contents/block-order/box_block_order_product_change_vagefisch_popup.php` — серверный блок попапа
  взвешивания (ajaxaction start/live/confirm/cancel/tare/zero → admin-panel). Пишет вес в поле
  `Kolichestvofakt`, статус в `Oshibkavesa`.
- `contents/block-order/box_block_order_product_change_vagefisch_popup.html` — фронт попапа + JS.
  **Fix 2026-07-04:** `hidden.bs.modal` отменяет сессию при закрытии крестиком; `shown.bs.modal`
  сбрасывает липкий статус RUNNING/STARTED → NEW.

## Настройки приложения (OneBox → app/settings/vagefisch)
- `vagefisch-api-base-url` (prod: `http://192.168.1.74:3000/api/v1`; demo: Tailscale `http://100.110.158.58:3000`)
- `vagefisch-api-token` (= admin-panel app_settings.onebox_api_token)
- `vagefisch-api-default-scale-id` = `Waage-1`
- `vagefisch-api-target-field-fact-weight` = `Kolichestvofakt`
- `vagefisch-api-target-field-weight-status` = `Oshibkavesa`

## Этикетка коробки
`vagefisch-box-label-template.zpl` — ZPL-шаблон (Zebra ZD621, термотрансфер), плейсхолдеры
{PRODUKT}/{GEWICHT}/{BARCODE}. Печать по USB/ZPL (`lp -o raw`), в обход замка меню принтера.
