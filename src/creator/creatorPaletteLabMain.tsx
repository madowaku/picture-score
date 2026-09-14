import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CreatorPaletteLab } from "./CreatorPaletteLab";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CreatorPaletteLab />
  </StrictMode>,
);
