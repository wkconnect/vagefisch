import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { RoleProvider, useRole } from "@/contexts/RoleContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  LayoutDashboard,
  Scale,
  Printer,
  GitBranch,
  ListTodo,
  FileText,
  Settings,
  Activity,
  LogOut,
  PanelLeft,
  Shield,
  Eye,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const SIDEBAR_WIDTH_KEY = "vagefisch-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <Scale className="h-10 w-10 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">{t('common.appName')}</h1>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {t('common.appDescription')}
            </p>
          </div>
          <div className="w-full space-y-4">
            <Button
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              size="lg"
              className="w-full"
            >
              {t('auth.signInToContinue')}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {t('auth.accessRequired')}
            </p>
          </div>
          <div className="pt-4">
            <LanguageSwitcher variant="inline" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <RoleProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
          } as CSSProperties
        }
      >
        <AdminLayoutContent setSidebarWidth={setSidebarWidth}>
          {children}
        </AdminLayoutContent>
      </SidebarProvider>
    </RoleProvider>
  );
}

type AdminLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function AdminLayoutContent({
  children,
  setSidebarWidth,
}: AdminLayoutContentProps) {
  const { user, logout } = useAuth();
  const { role, isAdmin } = useRole();
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const menuItems = [
    { icon: LayoutDashboard, labelKey: "nav.dashboard", path: "/" },
    { icon: Scale, labelKey: "nav.scales", path: "/scales" },
    { icon: Printer, labelKey: "nav.printers", path: "/printers" },
    { icon: GitBranch, labelKey: "nav.routing", path: "/routing" },
    { icon: ListTodo, labelKey: "nav.queue", path: "/queue" },
    { icon: FileText, labelKey: "nav.logs", path: "/logs" },
    { icon: Settings, labelKey: "nav.settings", path: "/settings" },
    { icon: Activity, labelKey: "nav.monitoring", path: "/monitoring" },
  ];

  const activeMenuItem = menuItems.find((item) => item.path === location);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const getRoleLabel = () => {
    if (isAdmin) return t('auth.admin');
    return t('auth.viewer');
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-border/50"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-border/50">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <Scale className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-semibold tracking-tight truncate">
                    {t('common.appName')}
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-2">
            <SidebarMenu className="px-2">
              {menuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={t(item.labelKey)}
                      className="h-10 transition-all font-normal"
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <span>{t(item.labelKey)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-border/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate leading-none">
                        {user?.name || "User"}
                      </p>
                      <Badge
                        variant={isAdmin ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0 h-4"
                      >
                        {isAdmin ? (
                          <Shield className="h-2.5 w-2.5 mr-0.5" />
                        ) : (
                          <Eye className="h-2.5 w-2.5 mr-0.5" />
                        )}
                        {getRoleLabel()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-xs">
                  <span className="flex items-center gap-2">
                    {isAdmin ? (
                      <Shield className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                    {t('auth.role')}: {getRoleLabel()}
                    {!isAdmin && ` (${t('auth.readOnly')})`}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <LanguageSwitcher variant="compact" />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('auth.signOut')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-muted/30">
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                <span className="font-medium">
                  {activeMenuItem ? t(activeMenuItem.labelKey) : t('common.appName')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher variant="compact" />
              <Badge variant={isAdmin ? "default" : "secondary"} className="text-xs">
                {getRoleLabel()}
              </Badge>
            </div>
          </div>
        )}
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
