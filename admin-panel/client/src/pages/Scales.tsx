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
import { Scale, Plus, Settings, Trash2, RefreshCw, Wifi, WifiOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type ScaleProtocol = "SICS" | "IND" | "MT-SICS" | "CUSTOM";
type ScaleStatus = "online" | "offline" | "error" | "unknown";

interface ScaleData {
  id: number;
  name: string;
  ip: string;
  port: number;
  protocol: ScaleProtocol;
  enabled: boolean;
  status: ScaleStatus;
  lastSeenAt: Date | null;
  lastError: string | null;
}

interface ScaleFormData {
  name: string;
  ip: string;
  port: number;
  protocol: ScaleProtocol;
  enabled: boolean;
}

const defaultFormData: ScaleFormData = {
  name: "",
  ip: "",
  port: 4001,
  protocol: "SICS",
  enabled: true,
};

export default function Scales() {
  const { canEdit } = useRole();
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScale, setEditingScale] = useState<ScaleData | null>(null);
  const [formData, setFormData] = useState<ScaleFormData>(defaultFormData);
  const [testingId, setTestingId] = useState<number | null>(null);

  // Queries
  const { data: scales = [], isLoading } = trpc.scales.list.useQuery();

  // Mutations
  const createMutation = trpc.scales.create.useMutation({
    onSuccess: () => {
      toast.success(t('scales.createSuccess'));
      utils.scales.list.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.scales.update.useMutation({
    onSuccess: () => {
      toast.success(t('scales.updateSuccess'));
      utils.scales.list.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.scales.delete.useMutation({
    onSuccess: () => {
      toast.success(t('scales.deleteSuccess'));
      utils.scales.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const testMutation = trpc.scales.test.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('scales.testSuccess', { latency: result.latencyMs }));
      } else {
        toast.error(t('scales.testFailed', { error: result.error }));
      }
      utils.scales.list.invalidate();
      setTestingId(null);
    },
    onError: (error) => {
      toast.error(error.message);
      setTestingId(null);
    },
  });

  const openCreateDialog = () => {
    setEditingScale(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (scale: ScaleData) => {
    setEditingScale(scale);
    setFormData({
      name: scale.name,
      ip: scale.ip,
      port: scale.port,
      protocol: scale.protocol,
      enabled: scale.enabled,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingScale(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.ip) {
      toast.error(t('common.fillRequired'));
      return;
    }

    if (editingScale) {
      updateMutation.mutate({ id: editingScale.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (scale: ScaleData) => {
    if (confirm(t('scales.confirmDelete', { name: scale.name }))) {
      deleteMutation.mutate({ id: scale.id });
    }
  };

  const handleTest = (scale: ScaleData) => {
    setTestingId(scale.id);
    testMutation.mutate({ id: scale.id });
  };

  const getStatusLabel = (status: ScaleStatus) => {
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
          <h1 className="text-2xl font-bold tracking-tight">{t('scales.title')}</h1>
          <p className="text-muted-foreground">{t('scales.subtitle')}</p>
        </div>
        {canEdit && (
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {t('scales.addScale')}
          </Button>
        )}
      </div>

      {/* Empty State */}
      {scales.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Scale className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('scales.noScales')}</h3>
            <p className="text-muted-foreground mb-4">{t('scales.noScalesDescription')}</p>
            {canEdit && (
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                {t('scales.addScale')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scales Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {scales.map((scale) => (
          <Card key={scale.id} className={!scale.enabled ? "opacity-60" : ""}>
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
                    {scale.lastError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleTest(scale)}
                    disabled={testingId === scale.id}
                  >
                    {testingId === scale.id ? (
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
                        onClick={() => openEditDialog(scale)}
                      >
                        <Settings className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(scale)}
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
              {editingScale ? t('scales.editScale') : t('scales.addScale')}
            </DialogTitle>
            <DialogDescription>
              {editingScale ? t('scales.editScaleDescription') : t('scales.addScaleDescription')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('scales.name')} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ICS-001"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ip">{t('scales.ipAddress')} *</Label>
                <Input
                  id="ip"
                  value={formData.ip}
                  onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                  placeholder="192.168.1.100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">{t('scales.port')}</Label>
                <Input
                  id="port"
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 4001 })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="protocol">{t('scales.protocol')}</Label>
              <Select
                value={formData.protocol}
                onValueChange={(value: ScaleProtocol) => setFormData({ ...formData, protocol: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SICS">SICS</SelectItem>
                  <SelectItem value="IND">IND</SelectItem>
                  <SelectItem value="MT-SICS">MT-SICS</SelectItem>
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
              {editingScale ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
