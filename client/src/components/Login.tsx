import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";

export const Login: React.FC = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, redirect to role home
  if (user) {
    return <Navigate to={user.role === "STUDENT" ? "/student" : "/supervisor"} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      // Let the re-render or navigate handle redirection
    } catch (err: any) {
      setError(err?.message || "Invalid email or password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card auth-card">
      <h2>Sign In</h2>
      <p className="muted">Use your course account to continue.</p>
      {error && (
        <div role="alert" className="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={isSubmitting} className="btn btn-block">
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>
      </form>
    </div>
  );
};
