import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/contexts/RoleContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { Scale, Plus, Settings, Trash2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

// Mock data for scales
const mockScales = [
  { id: "1", name: "ICS-001", protocol: "SICS", ip: "192.168.1.101", port: 4001, status: "online" as const, lastError: null },
  { id: "2", name: "ICS-002", protocol: "SICS", ip: "192.168.1.102", port: 4001, status: "online" as const, lastError: null },
  { id: "3", name: "IND-001", protocol: "IND", ip: "192.168.1.103", port: 4001, status: "offline" as const, lastError: "connectionTimeout" },
  { id: "4", name: "ICS-003", protocol: "SICS", ip: "192.168.1.104", port: 4001, status: "online" as const, lastError: null },
];

export default function Scales() {
  const { canEdit } = useRole();
  const { t } = useTranslation();

  const handleAction = (action: string) => {
    toast.info(t('common.featureComingSoon'));
  };

  const getStatusLabel = (status: string) => {
    return status === "online" ? t('common.online') : t('common.offline');
  };

  const getErrorMessage = (errorKey: string | null) => {
    if (!errorKey) return null;
    return t(`errors.${errorKey}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('scales.title')}</h1>
          <p className="text-muted-foreground">
            {t('scales.subtitle')}
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => handleAction("Add Scale")}>
            <Plus className="h-4 w-4 mr-2" />
            {t('scales.addScale')}
          </Button>
        )}
      </div>

      {/* Scales Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockScales.map((scale) => (
          <Card key={scale.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  {scale.name}
                </CardTitle>
                <Badge variant={scale.status === "online" ? "default" : "destructive"}>
                  {scale.status === "online" ? (
                    <Wifi className="h-3 w-3 mr-1" />
                  ) : (
                    <WifiOff className="h-3 w-3 mr-1" />
                  )}
                  {getStatusLabel(scale.status)}
                </Badge>
              </div>
              <CardDescription>
                {t('scales.protocol')}: {scale.protocol}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('scales.ipAddress')}</span>
                    <p className="font-mono">{scale.ip}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('scales.port')}</span>
                    <p className="font-mono">{scale.port}</p>
                  </div>
                </div>
                
                {scale.lastError && (
                  <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded text-sm text-red-600 dark:text-red-400">
                    {getErrorMessage(scale.lastError)}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleAction("Test Connection")}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {t('common.test')}
                  </Button>
                  {canEdit && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction("Edit Scale")}
                      >
                        <Settings className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleAction("Delete Scale")}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
