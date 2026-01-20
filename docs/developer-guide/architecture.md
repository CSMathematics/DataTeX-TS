# Architecture

DataTex is built using the **Tauri** framework, which allows for a secure, performant, and small-footprint application.

## The Stack

### Frontend (User Interface)

- **Language**: TypeScript
- **Framework**: React
- **UI Library**: Mantine UI (for components and styling)
- **Editor**: Monaco Editor (provides the code editing experience)
- **Build Tool**: Vite

The frontend handles all user interactions, visual rendering, and communicates with the backend via Tauri's IPC (Inter-Process Communication) bridge.

### Backend (Core Logic)

- **Language**: Rust
- **Framework**: Tauri Core
- **Database**: SQLite (via `sqlx` or `rusqlite`)

The backend is responsible for:

- File system operations (reading/writing files).
- Database management (indexing, searching).
- LaTeX compilation processes.
- Heavy computational tasks.
