import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import MaintenancePage, { isMaintenanceModeEnabled } from './MaintenancePage';
import { ConfigurationErrorPage, TestModeFrame } from './RuntimeGate';
import { readRuntimeConfig } from './runtimeConfig';
import reportWebVitals from './reportWebVitals';

class WelcomeFlowErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("WelcomeFlow render error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f7f4ff", color: "#160a43", fontFamily: "Inter, Arial, sans-serif", padding: 24 }}>
          <div style={{ maxWidth: 620, width: "100%", background: "#fff", border: "1px solid #ded3ff", borderRadius: 8, padding: 24, boxShadow: "0 20px 50px rgba(42,24,98,0.14)" }}>
            <h1 style={{ margin: "0 0 8px", fontSize: 26 }}>WelcomeFlow needs a refresh</h1>
            <p style={{ margin: "0 0 16px", color: "#6b5f93", lineHeight: 1.55 }}>The app hit a startup issue while loading saved workspace data. Your cloud data is not deleted.</p>
            <pre style={{ whiteSpace: "pre-wrap", background: "#f5f0ff", border: "1px solid #ded3ff", borderRadius: 6, padding: 12, color: "#4c1d95", fontSize: 12 }}>{[
              String(this.state.error?.message || this.state.error),
              this.state.error?.stack || "",
              this.state.info?.componentStack || "",
            ].filter(Boolean).join("\n\n")}</pre>
            <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 16, border: "1px solid #6d28d9", background: "#6d28d9", color: "#fff", borderRadius: 6, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}>Reload WelcomeFlow</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
const runtimeConfig = readRuntimeConfig();

if (isMaintenanceModeEnabled()) {
  root.render(
    <React.StrictMode>
      <MaintenancePage />
    </React.StrictMode>
  );
} else if (!runtimeConfig.ok) {
  root.render(
    <React.StrictMode>
      <ConfigurationErrorPage message={runtimeConfig.error} />
    </React.StrictMode>
  );
} else {
  import('./App').then(({ default: App }) => {
    const application = (
      <WelcomeFlowErrorBoundary>
        <App />
      </WelcomeFlowErrorBoundary>
    );
    root.render(
      <React.StrictMode>
        {runtimeConfig.isTest ? <TestModeFrame>{application}</TestModeFrame> : application}
      </React.StrictMode>
    );
  }).catch((error) => {
    root.render(
      <WelcomeFlowErrorBoundary>
        <div>{String(error?.message || error)}</div>
      </WelcomeFlowErrorBoundary>
    );
  });
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
