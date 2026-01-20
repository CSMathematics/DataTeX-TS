# Database Logic: Collections vs. Files

DataTex reimagines how LaTeX files are managed using a powerful **Logical Separation** model.

## The Old Way: Physical Files

Traditionally, you might organize your LaTeX projects into folders on your hard drive (e.g., `C:/MyDocs/Calculus`). If you wanted to reuse an exercise in another project, you'd copy the file, leading to duplication and versioning nightmares.

## The DataTex Way: Virtual Collections

In DataTex, all your content lives in a high-performance **SQLite Database**. Instead of physical folders, we use **Collections**.

### Key Concepts

1.  **The Database**: A single, unified repository for all your work.
2.  **Collections**: "Virtual Folders" that group related content. For example:
    - _Calculus 101_
    - _Linear Algebra_
    - _Exam Papers 2024_

### Benefits

- **Reuse**: A single file (e.g., "Derivative Definition") can belong to multiple Collections (e.g., "Calculus" AND "Exam Prep").
- **Speed**: Searching for "Theorem 5.1" scans the indexed database instantly, rather than reading thousands of text files.
- **Metadata**: Each file stores rich metadata (Difficulty, Tags, Subject) that goes beyond simple filenames.

## Using Collections

### Creating a Collection

1.  In the Sidebar, click the **+** icon.
2.  Select **New Collection**.
3.  Name it (e.g., "Geometry").

### Adding Files

You don't "save to a folder". You "tag" a file with a Collection.

- When creating a new file, the current active Collection is automatically assigned.
- You can move files between Collections by dragging and dropping in the Sidebar.
