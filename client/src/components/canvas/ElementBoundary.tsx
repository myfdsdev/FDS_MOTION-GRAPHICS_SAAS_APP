import { Component, type ReactNode } from "react";

/**
 * Per-element render boundary. If one element throws (bad data, broken
 * Lottie JSON, malformed bar-chart rows…) the rest of the canvas stays up
 * and the user gets a small red placeholder telling them which element
 * failed — instead of the whole editor going white.
 */
export class ElementBoundary extends Component<
  { children: ReactNode; label?: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error(`[Canvas] element "${this.props.label ?? "?"}" crashed:`, error);
  }
  reset = () => this.setState({ error: null });
  render() {
    if (this.state.error) {
      return (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255, 64, 64, 0.10)",
            border: "1px dashed rgba(255, 64, 64, 0.6)",
            borderRadius: 6,
            color: "rgba(255, 180, 180, 0.9)",
            fontSize: 11,
            padding: 6,
            textAlign: "center",
          }}
          title={this.state.error.message}
        >
          {this.props.label ?? "element"} error
        </div>
      );
    }
    return this.props.children;
  }
}
