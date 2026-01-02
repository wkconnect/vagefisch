import { useAuth } from "@/_core/hooks/useAuth";
import { createContext, useContext, ReactNode } from "react";

type Role = "admin" | "viewer";

interface RoleContextType {
  role: Role;
  isAdmin: boolean;
  isViewer: boolean;
  canEdit: boolean;
}

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  const role = (user?.role as Role) || "viewer";
  const isAdmin = role === "admin";
  const isViewer = role === "viewer";
  const canEdit = isAdmin;

  return (
    <RoleContext.Provider value={{ role, isAdmin, isViewer, canEdit }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
