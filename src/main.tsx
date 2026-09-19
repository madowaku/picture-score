import React from "react";
import ReactDOM from "react-dom/client";
import { RootShell } from "./RootShell";
import { LanguageProvider } from "./i18n/LanguageContext";
import { installPuchiMorph } from "./ui/puchiMorph";
import "./styles.css";
import "./wonder/wonder.css";
import "./garden/alive.css";
import "./garden/clearing.css";
import "./ui/puchi-notes.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <RootShell />
    </LanguageProvider>
  </React.StrictMode>,
);

installPuchiMorph();
