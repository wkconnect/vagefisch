import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/contexts/RoleContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { Printer, Plus, Settings, Trash2, FileText, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

// Mock data for printers
const mockPrinters = [
  { id: "1", name: "ZPL-01", ip: "192.168.1.201", port: 9100, status: "online" as const, queueLength: 3 },
  { id: "2", name: "ZPL-02", ip: "192.168.1.202", port: 9100, status: "online" as const, queueLength: 0 },
];

export default function Printers() {
  const { canEdit } = useRole();
  const { t } = useTranslation();

  const handleAction = (action: string) => {
    toast.info(t('common.featureComingSoon'));
  };

  const getStatusLabel = (status: string) => {
    return status === "online" ? t('common.online') : t('common.offline');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('printers.title')}</h1>
          <p className="text-muted-foreground">
            {t('printers.subtitle')}
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => handleAction("Add Printer")}>
            <Plus className="h-4 w-4 mr-2" />
            {t('printers.addPrinter')}
          </Button>
        )}
      </div>

      {/* Printers Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockPrinters.map((printer) => (
          <Card key={printer.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Printer className="h-5 w-5" />
                  {printer.name}
                </CardTitle>
                <Badge variant={printer.status === "online" ? "default" : "destructive"}>
                  {printer.status === "online" ? (
                    <Wifi className="h-3 w-3 mr-1" />
                  ) : (
                    <WifiOff className="h-3 w-3 mr-1" />
                  )}
                  {getStatusLabel(printer.status)}
                </Badge>
              </div>
              <CardDescription>
                {t('printers.printQueue')}: {printer.queueLength} {t('printers.jobs')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('scales.ipAddress')}</span>
                    <p className="font-mono">{printer.ip}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('scales.port')}</span>
                    <p className="font-mono">{printer.port}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleAction("Test Print")}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    {t('printers.testPrint')}
                  </Button>
                  {canEdit && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction("Edit Printer")}
                      >
                        <Settings className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleAction("Delete Printer")}
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
