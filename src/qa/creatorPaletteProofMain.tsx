import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CreatorPaletteProofView } from "./CreatorPaletteProofView";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CreatorPaletteProofView />
  </StrictMode>,
);
