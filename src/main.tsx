import React from "react";
import ReactDOM from "react-dom/client";
import { RootShell } from "./RootShell";
import { LanguageProvider } from "./i18n/LanguageContext";
import "./styles.css";
import "./mobile-studio.css";
import "./wonder/wonder.css";
import "./garden/alive.css";
import "./garden/clearing.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <RootShell />
    </LanguageProvider>
  </React.StrictMode>,
);
