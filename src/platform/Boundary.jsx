import React from "react";
export class Boundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="panel module-error" role="alert">
        <h3>{this.props.label || "此区域"}暂时未能显示</h3>
        <p>已保存的数据仍然保留，你可以继续使用其他区域。</p>
        <button
          className="button"
          onClick={() => this.setState({ failed: false })}
        >
          重试此区域
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}
