import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: "STUDENT" | "SUPERVISOR";
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRole }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div data-testid="auth-loading" style={{ padding: "20px" }}>Loading session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === "STUDENT" ? "/student" : "/supervisor"} replace />;
  }

  return <>{children}</>;
};
