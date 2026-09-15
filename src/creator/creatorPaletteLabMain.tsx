import {
  Component,
  StrictMode,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import { CreatorPaletteLab } from "./CreatorPaletteLab";

class CreatorPaletteLabBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };

  static getDerivedStateFromError(error: unknown): { error: string } {
    return {
      error: error instanceof Error && error.message
        ? error.message
        : "Creator Palette Lab stopped unexpectedly",
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("Creator Palette Lab runtime error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <main
        className="creator-lab"
        data-creator-lab-crash={this.state.error}
      >
        <section className="creator-lab-header">
          <div>
            <p>PICTURE SCORE • CREATOR PALETTE LAB</p>
            <h1>The Lab stopped safely.</h1>
            <span className="creator-lab-status">{this.state.error}</span>
          </div>
          <button type="button" onClick={() => window.location.reload()}>
            Reload Lab
          </button>
        </section>
      </main>;
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CreatorPaletteLabBoundary>
      <CreatorPaletteLab />
    </CreatorPaletteLabBoundary>
  </StrictMode>,
);
