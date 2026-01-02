import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/contexts/RoleContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { GitBranch, Plus, Settings, Trash2, Scale, ArrowRight } from "lucide-react";
import { toast } from "sonner";

// Mock data for routing rules
const mockRoutes = [
  { id: "1", name: "Default Route", type: "round-robin", scales: ["ICS-001", "ICS-002", "ICS-003"], enabled: true },
  { id: "2", name: "Heavy Items", type: "manual", scales: ["IND-001"], enabled: true },
  { id: "3", name: "Express Lane", type: "capacity", scales: ["ICS-001"], enabled: false },
];

export default function Routing() {
  const { canEdit } = useRole();
  const { t } = useTranslation();

  const handleAction = (action: string) => {
    toast.info(t('common.featureComingSoon'));
  };

  const getRouteTypeLabel = (type: string) => {
    switch (type) {
      case "round-robin": return t('routing.roundRobin');
      case "manual": return t('routing.manual');
      case "capacity": return t('routing.capacity');
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('routing.title')}</h1>
          <p className="text-muted-foreground">
            {t('routing.subtitle')}
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => handleAction("Add Route")}>
            <Plus className="h-4 w-4 mr-2" />
            {t('routing.addRoute')}
          </Button>
        )}
      </div>

      {/* Routes List */}
      <div className="space-y-4">
        {mockRoutes.map((route) => (
          <Card key={route.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  {route.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{getRouteTypeLabel(route.type)}</Badge>
                  <Badge variant={route.enabled ? "default" : "secondary"}>
                    {route.enabled ? t('common.enabled') : t('common.disabled')}
                  </Badge>
                </div>
              </div>
              <CardDescription>
                {t('routing.routesToScales', { count: route.scales.length })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">{t('routing.targetScales')}:</span>
                {route.scales.map((scale, idx) => (
                  <span key={scale} className="flex items-center gap-1">
                    <Badge variant="outline" className="font-mono">
                      <Scale className="h-3 w-3 mr-1" />
                      {scale}
                    </Badge>
                    {idx < route.scales.length - 1 && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    )}
                  </span>
                ))}
              </div>
              
              {canEdit && (
                <div className="flex gap-2 pt-4 mt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction("Edit Route")}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleAction("Delete Route")}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {t('common.delete')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
