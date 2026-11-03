import { useEffect, useState } from "react";
import { getHealth } from "./api.js";

// Application shell. Routes and screens are added as each Sprint feature is implemented.
export default function App() {
  const [apiStatus, setApiStatus] = useState("checking...");

  useEffect(() => {
    getHealth()
      .then((h) => setApiStatus(h.status))
      .catch(() => setApiStatus("unreachable"));
  }, []);

  return (
    <main>
      <h1>Course Project Management System</h1>
      <p data-testid="api-status">API: {apiStatus}</p>
    </main>
  );
}
