import { describe, expect, it } from "vitest";

/**
 * i18n Architecture Tests
 * Validates that the internationalization system is properly configured
 */

describe("i18n Architecture", () => {
  it("should have German (DE) as the primary language", async () => {
    // Import the i18n configuration
    const { DEFAULT_LANGUAGE } = await import("../client/src/i18n/index");
    expect(DEFAULT_LANGUAGE).toBe("de");
  });

  it("should have both DE and RU translations available", async () => {
    const { translations } = await import("../client/src/i18n/index");
    expect(translations).toHaveProperty("de");
    expect(translations).toHaveProperty("ru");
  });

  it("should have complete navigation translations in DE", async () => {
    const { translations } = await import("../client/src/i18n/index");
    const de = translations.de as Record<string, Record<string, string>>;
    
    expect(de.nav).toBeDefined();
    expect(de.nav.dashboard).toBe("Dashboard");
    expect(de.nav.scales).toBe("Waagen");
    expect(de.nav.printers).toBe("Drucker");
    expect(de.nav.routing).toBe("Routing");
    expect(de.nav.queue).toBe("Warteschlange / Aufgaben");
    expect(de.nav.logs).toBe("Protokolle");
    expect(de.nav.settings).toBe("Einstellungen");
    expect(de.nav.monitoring).toBe("Überwachung");
  });

  it("should have complete navigation translations in RU", async () => {
    const { translations } = await import("../client/src/i18n/index");
    const ru = translations.ru as Record<string, Record<string, string>>;
    
    expect(ru.nav).toBeDefined();
    expect(ru.nav.dashboard).toBe("Панель управления");
    expect(ru.nav.scales).toBe("Весы");
    expect(ru.nav.printers).toBe("Принтеры");
    expect(ru.nav.routing).toBe("Маршрутизация");
    expect(ru.nav.queue).toBe("Очередь / Задачи");
    expect(ru.nav.logs).toBe("Журналы");
    expect(ru.nav.settings).toBe("Настройки");
    expect(ru.nav.monitoring).toBe("Мониторинг");
  });

  it("should have dashboard translations in both languages", async () => {
    const { translations } = await import("../client/src/i18n/index");
    const de = translations.de as Record<string, Record<string, string>>;
    const ru = translations.ru as Record<string, Record<string, string>>;
    
    // DE
    expect(de.dashboard).toBeDefined();
    expect(de.dashboard.title).toBe("Dashboard");
    expect(de.dashboard.connector).toBe("Connector");
    expect(de.dashboard.onebox).toBe("OneBox");
    expect(de.dashboard.scales).toBe("Waagen");
    expect(de.dashboard.printers).toBe("Drucker");
    
    // RU
    expect(ru.dashboard).toBeDefined();
    expect(ru.dashboard.title).toBe("Панель управления");
    expect(ru.dashboard.connector).toBe("Коннектор");
    expect(ru.dashboard.onebox).toBe("OneBox");
    expect(ru.dashboard.scales).toBe("Весы");
    expect(ru.dashboard.printers).toBe("Принтеры");
  });

  it("should have status translations in both languages", async () => {
    const { translations } = await import("../client/src/i18n/index");
    const de = translations.de as Record<string, Record<string, string>>;
    const ru = translations.ru as Record<string, Record<string, string>>;
    
    // DE status
    expect(de.common.running).toBe("Läuft");
    expect(de.common.stopped).toBe("Gestoppt");
    expect(de.common.connected).toBe("Verbunden");
    expect(de.common.disconnected).toBe("Getrennt");
    expect(de.common.online).toBe("Online");
    expect(de.common.offline).toBe("Offline");
    
    // RU status
    expect(ru.common.running).toBe("Работает");
    expect(ru.common.stopped).toBe("Остановлено");
    expect(ru.common.connected).toBe("Подключено");
    expect(ru.common.disconnected).toBe("Отключено");
    expect(ru.common.online).toBe("Онлайн");
    expect(ru.common.offline).toBe("Офлайн");
  });

  it("should have localStorage key for language persistence", async () => {
    const { LANGUAGE_STORAGE_KEY } = await import("../client/src/i18n/index");
    expect(LANGUAGE_STORAGE_KEY).toBe("vagefisch-language");
  });
});
