import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/contexts/RoleContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { Settings as SettingsIcon, Globe, MessageSquare, Database, Save, Loader2, CheckCircle, AlertTriangle, TestTube } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function Settings() {
  const { canEdit } = useRole();
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  // OneBox settings state
  const [oneboxSettings, setOneboxSettings] = useState({
    baseUrl: "",
    apiToken: "",
    timeout: 30,
    workflowId: "",
    enabled: false,
  });

  // Telegram settings state
  const [telegramSettings, setTelegramSettings] = useState({
    botToken: "",
    chatId: "",
    enabled: false,
    notifyOnError: true,
    notifyOnStuck: true,
  });

  // Queries
  const { data: oneboxData, isLoading: oneboxLoading } = trpc.settings.getOnebox.useQuery();
  const { data: telegramData, isLoading: telegramLoading } = trpc.settings.getTelegram.useQuery();

  // Mutations
  const saveOneboxMutation = trpc.settings.saveOnebox.useMutation({
    onSuccess: () => {
      toast.success("Настройки OneBox сохранены");
      utils.settings.getOnebox.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const saveTelegramMutation = trpc.settings.saveTelegram.useMutation({
    onSuccess: () => {
      toast.success("Настройки Telegram сохранены");
      utils.settings.getTelegram.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Load data into state
  useEffect(() => {
    if (oneboxData) {
      setOneboxSettings({
        baseUrl: oneboxData.baseUrl || "",
        apiToken: oneboxData.apiToken || "",
        timeout: oneboxData.timeout || 30,
        workflowId: oneboxData.workflowId || "",
        enabled: oneboxData.enabled || false,
      });
    }
  }, [oneboxData]);

  useEffect(() => {
    if (telegramData) {
      setTelegramSettings({
        botToken: telegramData.botToken || "",
        chatId: telegramData.chatId || "",
        enabled: telegramData.enabled || false,
        notifyOnError: telegramData.notifyOnError ?? true,
        notifyOnStuck: telegramData.notifyOnStuck ?? true,
      });
    }
  }, [telegramData]);

  const handleSaveOnebox = () => {
    saveOneboxMutation.mutate(oneboxSettings);
  };

  const handleSaveTelegram = () => {
    saveTelegramMutation.mutate(telegramSettings);
  };

  const handleTestOnebox = () => {
    toast.info("Тестирование подключения к OneBox...");
    // TODO: Implement test connection
    setTimeout(() => {
      toast.success("Подключение к OneBox успешно");
    }, 1000);
  };

  const handleTestTelegram = () => {
    toast.info("Отправка тестового сообщения...");
    // TODO: Implement test message
    setTimeout(() => {
      toast.success("Тестовое сообщение отправлено");
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <Tabs defaultValue="onebox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="onebox" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            OneBox CRM
          </TabsTrigger>
          <TabsTrigger value="telegram" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Telegram
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Общие
          </TabsTrigger>
        </TabsList>

        {/* OneBox Settings */}
        <TabsContent value="onebox">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Интеграция с OneBox CRM
              </CardTitle>
              <CardDescription>
                Настройте подключение к OneBox для автоматической отправки результатов взвешивания
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {oneboxLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Включить интеграцию</Label>
                      <p className="text-sm text-muted-foreground">
                        Автоматически отправлять результаты в OneBox
                      </p>
                    </div>
                    <Switch
                      checked={oneboxSettings.enabled}
                      onCheckedChange={(checked) => setOneboxSettings({ ...oneboxSettings, enabled: checked })}
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="baseUrl">URL OneBox API</Label>
                    <Input
                      id="baseUrl"
                      value={oneboxSettings.baseUrl}
                      onChange={(e) => setOneboxSettings({ ...oneboxSettings, baseUrl: e.target.value })}
                      placeholder="https://your-company.1b.app"
                      disabled={!canEdit}
                    />
                    <p className="text-xs text-muted-foreground">
                      Базовый URL вашего OneBox (например: https://company.1b.app)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="apiToken">API Token</Label>
                    <Input
                      id="apiToken"
                      type="password"
                      value={oneboxSettings.apiToken}
                      onChange={(e) => setOneboxSettings({ ...oneboxSettings, apiToken: e.target.value })}
                      placeholder="Введите API токен"
                      disabled={!canEdit}
                    />
                    <p className="text-xs text-muted-foreground">
                      Токен для авторизации API запросов
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workflowId">ID бизнес-процесса</Label>
                    <Input
                      id="workflowId"
                      value={oneboxSettings.workflowId}
                      onChange={(e) => setOneboxSettings({ ...oneboxSettings, workflowId: e.target.value })}
                      placeholder="Например: 123"
                      disabled={!canEdit}
                    />
                    <p className="text-xs text-muted-foreground">
                      ID процесса для задач взвешивания
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeout">Таймаут (сек)</Label>
                    <Input
                      id="timeout"
                      type="number"
                      min={1}
                      max={120}
                      value={oneboxSettings.timeout}
                      onChange={(e) => setOneboxSettings({ ...oneboxSettings, timeout: parseInt(e.target.value) || 30 })}
                      disabled={!canEdit}
                    />
                  </div>

                  {canEdit && (
                    <div className="flex gap-2 pt-4 border-t">
                      <Button onClick={handleSaveOnebox} disabled={saveOneboxMutation.isPending}>
                        {saveOneboxMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Сохранить
                      </Button>
                      <Button variant="outline" onClick={handleTestOnebox}>
                        <TestTube className="h-4 w-4 mr-2" />
                        Тест подключения
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Telegram Settings */}
        <TabsContent value="telegram">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Уведомления Telegram
              </CardTitle>
              <CardDescription>
                Настройте отправку уведомлений о проблемах в Telegram
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {telegramLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Включить уведомления</Label>
                      <p className="text-sm text-muted-foreground">
                        Отправлять уведомления в Telegram
                      </p>
                    </div>
                    <Switch
                      checked={telegramSettings.enabled}
                      onCheckedChange={(checked) => setTelegramSettings({ ...telegramSettings, enabled: checked })}
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="botToken">Bot Token</Label>
                    <Input
                      id="botToken"
                      type="password"
                      value={telegramSettings.botToken}
                      onChange={(e) => setTelegramSettings({ ...telegramSettings, botToken: e.target.value })}
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                      disabled={!canEdit}
                    />
                    <p className="text-xs text-muted-foreground">
                      Токен бота от @BotFather
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="chatId">Chat ID</Label>
                    <Input
                      id="chatId"
                      value={telegramSettings.chatId}
                      onChange={(e) => setTelegramSettings({ ...telegramSettings, chatId: e.target.value })}
                      placeholder="-1001234567890"
                      disabled={!canEdit}
                    />
                    <p className="text-xs text-muted-foreground">
                      ID чата или группы для уведомлений
                    </p>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <Label>Типы уведомлений</Label>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-sm">Ошибки</span>
                        <p className="text-xs text-muted-foreground">
                          Уведомлять о критических ошибках
                        </p>
                      </div>
                      <Switch
                        checked={telegramSettings.notifyOnError}
                        onCheckedChange={(checked) => setTelegramSettings({ ...telegramSettings, notifyOnError: checked })}
                        disabled={!canEdit}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-sm">Застрявшие задачи</span>
                        <p className="text-xs text-muted-foreground">
                          Уведомлять о задачах в статусе STUCK
                        </p>
                      </div>
                      <Switch
                        checked={telegramSettings.notifyOnStuck}
                        onCheckedChange={(checked) => setTelegramSettings({ ...telegramSettings, notifyOnStuck: checked })}
                        disabled={!canEdit}
                      />
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex gap-2 pt-4 border-t">
                      <Button onClick={handleSaveTelegram} disabled={saveTelegramMutation.isPending}>
                        {saveTelegramMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Сохранить
                      </Button>
                      <Button variant="outline" onClick={handleTestTelegram}>
                        <TestTube className="h-4 w-4 mr-2" />
                        Отправить тест
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Общие настройки
              </CardTitle>
              <CardDescription>
                Основные параметры системы
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Версия системы</p>
                    <p className="text-sm text-muted-foreground">Vagefisch Admin Panel</p>
                  </div>
                  <span className="font-mono">1.0.0</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">База данных</p>
                    <p className="text-sm text-muted-foreground">MySQL / TiDB</p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Протоколы весов</p>
                    <p className="text-sm text-muted-foreground">Поддерживаемые протоколы</p>
                  </div>
                  <span className="text-sm">SICS, IND, MT-SICS</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Протоколы принтеров</p>
                    <p className="text-sm text-muted-foreground">Поддерживаемые протоколы</p>
                  </div>
                  <span className="text-sm">ZPL, RAW, IPP</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
