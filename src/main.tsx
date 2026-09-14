import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LanguageProvider } from "./i18n/LanguageContext";
import { MobileStudioChrome } from "./ui/MobileStudioChrome";
import "./styles.css";
import "./mobile-studio.css";
import "./wonder/wonder.css";
import "./garden/alive.css";
import "./garden/clearing.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
      <MobileStudioChrome />
    </LanguageProvider>
  </React.StrictMode>,
);
