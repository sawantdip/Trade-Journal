import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

class FatalBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("React crash:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, color: "#ffb4b4", fontFamily: "Segoe UI" }}>
          <h2>App crashed</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{String(this.state.error?.message || this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById("root");
window.addEventListener("error", (e) => console.error("window.error", e.error || e.message));

createRoot(rootEl).render(
  <React.StrictMode>
    <FatalBoundary>
      <App />
    </FatalBoundary>
  </React.StrictMode>
);
