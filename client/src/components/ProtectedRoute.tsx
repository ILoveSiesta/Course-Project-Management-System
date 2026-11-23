import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: "STUDENT" | "SUPERVISOR";
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRole }) => {
  const { user, isLoading, sessionError, retrySession } = useAuth();

  if (isLoading) {
    return <p data-testid="auth-loading" className="loading">Loading session...</p>;
  }

  // #94 B2: the session could not be checked (not a 401); the token is kept and the check can be repeated.
  if (!user && sessionError) {
    return (
      <div className="card">
        <p role="alert" className="alert">{sessionError}</p>
        <button type="button" className="btn" onClick={retrySession}>
          Try again
        </button>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === "STUDENT" ? "/student" : "/supervisor"} replace />;
  }

  return <>{children}</>;
};
