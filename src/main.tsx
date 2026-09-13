import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LanguageProvider } from "./i18n/LanguageContext";
import { ReleaseShell } from "./release/ReleaseShell";
import "./styles.css";
import "./wonder/wonder.css";
import "./garden/alive.css";
import "./garden/clearing.css";
import "./release/release.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <ReleaseShell>
        <App />
      </ReleaseShell>
    </LanguageProvider>
  </React.StrictMode>,
);
