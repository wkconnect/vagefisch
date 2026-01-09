import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRole } from "@/contexts/RoleContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { Printer, Plus, Settings, Trash2, RefreshCw, Wifi, WifiOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type PrinterProtocol = "ZPL" | "RAW" | "IPP" | "CUSTOM";
type PrinterStatus = "online" | "offline" | "error" | "unknown";

interface PrinterData {
  id: number;
  name: string;
  ip: string;
  port: number;
  protocol: PrinterProtocol;
  enabled: boolean;
  status: PrinterStatus;
  lastSeenAt: Date | null;
  lastError: string | null;
}

interface PrinterFormData {
  name: string;
  ip: string;
  port: number;
  protocol: PrinterProtocol;
  enabled: boolean;
}

const defaultFormData: PrinterFormData = {
  name: "",
  ip: "",
  port: 9100,
  protocol: "ZPL",
  enabled: true,
};

export default function Printers() {
  const { canEdit } = useRole();
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterData | null>(null);
  const [formData, setFormData] = useState<PrinterFormData>(defaultFormData);
  const [testingId, setTestingId] = useState<number | null>(null);

  // Queries
  const { data: printers = [], isLoading } = trpc.printers.list.useQuery();

  // Mutations
  const createMutation = trpc.printers.create.useMutation({
    onSuccess: () => {
      toast.success(t('printers.createSuccess'));
      utils.printers.list.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.printers.update.useMutation({
    onSuccess: () => {
      toast.success(t('printers.updateSuccess'));
      utils.printers.list.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.printers.delete.useMutation({
    onSuccess: () => {
      toast.success(t('printers.deleteSuccess'));
      utils.printers.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const testMutation = trpc.printers.test.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('printers.testSuccess', { latency: result.latencyMs }));
      } else {
        toast.error(t('printers.testFailed', { error: result.error }));
      }
      utils.printers.list.invalidate();
      setTestingId(null);
    },
    onError: (error) => {
      toast.error(error.message);
      setTestingId(null);
    },
  });

  const openCreateDialog = () => {
    setEditingPrinter(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (printer: PrinterData) => {
    setEditingPrinter(printer);
    setFormData({
      name: printer.name,
      ip: printer.ip,
      port: printer.port,
      protocol: printer.protocol,
      enabled: printer.enabled,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingPrinter(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.ip) {
      toast.error(t('common.fillRequired'));
      return;
    }

    if (editingPrinter) {
      updateMutation.mutate({ id: editingPrinter.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (printer: PrinterData) => {
    if (confirm(t('printers.confirmDelete', { name: printer.name }))) {
      deleteMutation.mutate({ id: printer.id });
    }
  };

  const handleTest = (printer: PrinterData) => {
    setTestingId(printer.id);
    testMutation.mutate({ id: printer.id });
  };

  const getStatusLabel = (status: PrinterStatus) => {
    return status === "online" ? t('common.online') : t('common.offline');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('printers.title')}</h1>
          <p className="text-muted-foreground">{t('printers.subtitle')}</p>
        </div>
        {canEdit && (
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {t('printers.addPrinter')}
          </Button>
        )}
      </div>

      {/* Empty State */}
      {printers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Printer className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('printers.noPrinters')}</h3>
            <p className="text-muted-foreground mb-4">{t('printers.noPrintersDescription')}</p>
            {canEdit && (
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                {t('printers.addPrinter')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Printers Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {printers.map((printer) => (
          <Card key={printer.id} className={!printer.enabled ? "opacity-60" : ""}>
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
                {t('printers.protocol')}: {printer.protocol}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('printers.ipAddress')}</span>
                    <p className="font-mono">{printer.ip}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('printers.port')}</span>
                    <p className="font-mono">{printer.port}</p>
                  </div>
                </div>
                
                {printer.lastError && (
                  <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded text-sm text-red-600 dark:text-red-400">
                    {printer.lastError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleTest(printer)}
                    disabled={testingId === printer.id}
                  >
                    {testingId === printer.id ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    {t('common.test')}
                  </Button>
                  {canEdit && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(printer)}
                      >
                        <Settings className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(printer)}
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPrinter ? t('printers.editPrinter') : t('printers.addPrinter')}
            </DialogTitle>
            <DialogDescription>
              {editingPrinter ? t('printers.editPrinterDescription') : t('printers.addPrinterDescription')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('printers.name')} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ZPL-001"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ip">{t('printers.ipAddress')} *</Label>
                <Input
                  id="ip"
                  value={formData.ip}
                  onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                  placeholder="192.168.1.200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">{t('printers.port')}</Label>
                <Input
                  id="port"
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 9100 })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="protocol">{t('printers.protocol')}</Label>
              <Select
                value={formData.protocol}
                onValueChange={(value: PrinterProtocol) => setFormData({ ...formData, protocol: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZPL">ZPL (Zebra)</SelectItem>
                  <SelectItem value="RAW">RAW</SelectItem>
                  <SelectItem value="IPP">IPP</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingPrinter ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
