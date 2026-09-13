import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CoreMeaningQaView } from "./CoreMeaningQaView";

const root = document.getElementById("root");
if (!root) throw new Error("core meaning QA root missing");

createRoot(root).render(
  <StrictMode>
    <CoreMeaningQaView />
  </StrictMode>,
);
