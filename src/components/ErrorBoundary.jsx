import { Component } from "react";
import { TriangleAlert } from "lucide-react";

/**
 * ErrorBoundary
 *
 * Wraps any part of the UI. If a child component throws during render,
 * this catches the error and shows a friendly recovery screen instead of
 * a blank white page.
 *
 * Usage in App.jsx:
 *   import ErrorBoundary from "./components/ErrorBoundary";
 *   <ErrorBoundary><Sales ownerUid={user.uid} /></ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[QuickDuka] Render error caught by ErrorBoundary:", error, info);
    this.setState({ info });
  }

  handleReset = () => {
    this.setState({ error: null, info: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: "40px 24px",
            textAlign: "center",
            maxWidth: 440,
            margin: "60px auto",
            background: "var(--card, #fff)",
            borderRadius: "var(--radius)",
            boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
            border: "1px solid var(--border, #e5e7eb)",
          }}
        >
          <div style={{ marginBottom: 12, color: "var(--orange, #f59e0b)" }}><TriangleAlert size={40} strokeWidth={1.5} aria-hidden="true" /></div>
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: 18,
              color: "var(--text, #111)",
              fontWeight: 700,
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              margin: "0 0 6px",
              fontSize: 13,
              color: "var(--muted, #888)",
              lineHeight: 1.5,
            }}
          >
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <p
            style={{
              margin: "0 0 20px",
              fontSize: 12,
              color: "var(--muted, #aaa)",
            }}
          >
            The rest of your app is still working, only this section crashed.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: "10px 24px",
              background: "var(--accent, #2563eb)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
