# DataTex - Modern LaTeX Editor

DataTex is a next-generation LaTeX editor built for speed and usability, leveraging the power of **Tauri**, **React**, and **Rust**. It goes beyond standard editing by offering a suite of visual tools that simplify complex LaTeX tasks.

![[Pasted image 20260120135255.png]]
## 🚀 Unique Features

### ✨ Visual Generators (Wizards)
Forget about memorizing complex syntax. DataTex provides interactive wizards for the most challenging parts of LaTeX:

- **Fancyhdr Wizard**: Visually design your document's headers and footers with a real-time preview.
- **TikZ & PSTricks Wizards**: A powerful GUI to generate complex vector graphics code without writing a single line of code manually.
- **Table Wizard**: Create and edit professional tables effortlessly. handle row/column merging and alignment visually.

### 🧠 Smart Management
- **Package Gallery**: A browsable, visual catalog of LaTeX packages. Read descriptions, see usage examples, and add them to your project with a single click.
- **Preamble Wizard**: specialized interface to manage global document settings, macros, and environments without cluttering your main document.

### ⚡ Architecture
- **Rust-Powered Database**: Built-in SQLite database managed by Rust for lightning-fast indexing and retrieval of your documents and projects.
- **Modern Tech Stack**: Built on Tauri and React, ensuring the application is lightweight, cross-platform, and responsive.

## Getting Started

```bash
pnpm tauri dev
```
