import { Component, type ReactNode } from "react";
import { StudyStatus } from "./study-status";
export class SceneBoundary extends Component<{ children: ReactNode }, { error?: string }> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? <StudyStatus message={this.state.error} /> : this.props.children;
  }
}
