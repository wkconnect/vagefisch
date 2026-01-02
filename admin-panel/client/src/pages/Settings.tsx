import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/contexts/RoleContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { Settings as SettingsIcon, Zap, MessageSquare, Sliders, Save, TestTube, Eye } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { canEdit, isViewer } = useRole();
  const { t } = useTranslation();

  const handleSave = (section: string) => {
    toast.info(t('common.featureComingSoon'));
  };

  const handleTest = (service: string) => {
    toast.info(t('common.featureComingSoon'));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-muted-foreground">
          {t('settings.subtitle')}
        </p>
      </div>

      {isViewer && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Eye className="h-4 w-4" />
              <span className="text-sm">{t('settings.readOnlyAccess')}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="onebox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="onebox" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            OneBox
          </TabsTrigger>
          <TabsTrigger value="telegram" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Telegram
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Sliders className="h-4 w-4" />
            {t('settings.general.title')}
          </TabsTrigger>
        </TabsList>

        {/* OneBox Settings */}
        <TabsContent value="onebox">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                {t('settings.onebox.title')}
              </CardTitle>
              <CardDescription>
                {t('settings.onebox.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="onebox-url">{t('settings.onebox.baseUrl')}</Label>
                  <Input
                    id="onebox-url"
                    placeholder="https://onebox.example.com/api"
                    defaultValue="https://192.168.1.10/api"
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onebox-token">{t('settings.onebox.apiToken')}</Label>
                  <Input
                    id="onebox-token"
                    type="password"
                    placeholder="••••••••"
                    defaultValue="••••••••••••••••"
                    disabled={!canEdit}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="onebox-timeout">{t('settings.onebox.timeout')}</Label>
                <Input
                  id="onebox-timeout"
                  type="number"
                  placeholder="30"
                  defaultValue="30"
                  className="w-32"
                  disabled={!canEdit}
                />
              </div>
              {canEdit && (
                <div className="flex gap-2 pt-4">
                  <Button onClick={() => handleTest("OneBox Connection")}>
                    <TestTube className="h-4 w-4 mr-2" />
                    {t('settings.onebox.testConnection')}
                  </Button>
                  <Button variant="outline" onClick={() => handleSave("OneBox")}>
                    <Save className="h-4 w-4 mr-2" />
                    {t('common.save')}
                  </Button>
                </div>
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
                {t('settings.telegram.title')}
              </CardTitle>
              <CardDescription>
                {t('settings.telegram.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="telegram-token">{t('settings.telegram.botToken')}</Label>
                  <Input
                    id="telegram-token"
                    type="password"
                    placeholder="••••••••"
                    defaultValue="••••••••••••••••"
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telegram-chat">{t('settings.telegram.chatId')}</Label>
                  <Input
                    id="telegram-chat"
                    placeholder="-1001234567890"
                    defaultValue="-1001234567890"
                    disabled={!canEdit}
                  />
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-2 pt-4">
                  <Button onClick={() => handleTest("Telegram Alert")}>
                    <TestTube className="h-4 w-4 mr-2" />
                    {t('settings.telegram.sendTestAlert')}
                  </Button>
                  <Button variant="outline" onClick={() => handleSave("Telegram")}>
                    <Save className="h-4 w-4 mr-2" />
                    {t('common.save')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sliders className="h-5 w-5" />
                {t('settings.general.title')}
              </CardTitle>
              <CardDescription>
                {t('settings.general.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="default-unit">{t('settings.general.defaultUnit')}</Label>
                  <Select defaultValue="kg" disabled={!canEdit}>
                    <SelectTrigger id="default-unit">
                      <SelectValue placeholder="kg" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">{t('settings.general.kilograms')}</SelectItem>
                      <SelectItem value="lb">{t('settings.general.pounds')}</SelectItem>
                      <SelectItem value="g">{t('settings.general.grams')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stabilization-timeout">{t('settings.general.stabilizationTimeout')}</Label>
                  <Input
                    id="stabilization-timeout"
                    type="number"
                    placeholder="3000"
                    defaultValue="3000"
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retry-count">{t('settings.general.retryCount')}</Label>
                  <Input
                    id="retry-count"
                    type="number"
                    placeholder="3"
                    defaultValue="3"
                    disabled={!canEdit}
                  />
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => handleSave("General")}>
                    <Save className="h-4 w-4 mr-2" />
                    {t('common.save')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
