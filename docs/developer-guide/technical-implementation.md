# Technical Implementation

## Database Schema

DataTex uses a single SQLite database file (`project.db`) to manage what appears to the user as multiple independent collections.

### Files Table (`files`)

Stores the actual content and metadata of LaTeX fragments.

| Column       | Type    | Description                                 |
| :----------- | :------ | :------------------------------------------ |
| `id`         | INTEGER | Primary Key                                 |
| `filename`   | TEXT    | Physical filename (e.g., `exercise_01.tex`) |
| `collection` | TEXT    | The "virtual folder" this file belongs to   |
| `content`    | TEXT    | The LaTeX code                              |
| `type`       | TEXT    | e.g., 'exercise', 'theorem', 'definition'   |

### Documents Table (`documents`)

Represents complete compilable documents that are composed of multiple files.

| Column     | Type    | Description                                |
| :--------- | :------ | :----------------------------------------- |
| `id`       | INTEGER | Primary Key                                |
| `title`    | TEXT    | User-friendly title                        |
| `category` | TEXT    | e.g., 'Exam', 'Notes'                      |
| `file_ids` | JSON    | List of file IDs included in this document |

## Logical Separation

When a user selects "Calculus" in the sidebar, the backend executes:

```sql
SELECT * FROM files WHERE collection = 'Calculus'
```

This allows for instant context switching without reloading different database connection capabilities, significantly improving performance over traditional multi-file database approaches.
