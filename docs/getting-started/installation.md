# Installation

Currently, DataTex v2 is in active development. The recommended way to run it is by building from source.

## Prerequisites

Before you begin, ensure you have the following installed:

1.  **Node.js** (v18 or newer) & **pnpm**:
    ```bash
    npm install -g pnpm
    ```
2.  **Rust**:
    Install standard Rust toolchain from [rustup.rs](https://rustup.rs/).
3.  **Tauri Dependencies**:
    Follow the [Tauri Prerequisites guide](https://tauri.app/v1/guides/getting-started/prerequisites) for your OS.

## Building from Source

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/CSMathematics/DataTex.git
    cd DataTex
    ```

2.  **Install JavaScript dependencies**:

    ```bash
    pnpm install
    ```

3.  **Run in Development Mode**:
    This will start the frontend server and the Tauri application window.

    ```bash
    pnpm tauri dev
    ```

4.  **Build for Production**:
    To create an optimized executable for your system:
    ```bash
    pnpm tauri build
    ```
    The output will be located in `src-tauri/target/release/bundle/`.
