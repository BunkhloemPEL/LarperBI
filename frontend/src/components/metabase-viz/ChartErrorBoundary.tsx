import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || "Unknown rendering error" };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Chart rendering error caught by boundary:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: "" });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem 1rem",
            backgroundColor: "#fffaf0",
            border: "1px solid #feebc8",
            borderRadius: "8px",
            color: "#744210",
            textAlign: "center",
            width: "100%",
            height: "100%",
            minHeight: "180px",
          }}
        >
          <AlertTriangle size={24} color="#dd6b20" style={{ marginBottom: "0.5rem" }} />
          <div style={{ fontSize: "0.8125rem", fontWeight: 700, marginBottom: "0.25rem" }}>
            {this.props.fallbackMessage || "Unable to render this visual with current parameters"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#975a16", maxWidth: "340px", marginBottom: "0.75rem" }}>
            {this.state.errorMessage}
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "0.75rem",
              padding: "0.25rem 0.625rem",
              borderRadius: "4px",
              border: "1px solid #dd6b20",
              background: "#ffffff",
              color: "#c05621",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={11} /> Retry Render
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
