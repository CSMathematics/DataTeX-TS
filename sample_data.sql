-- Add sample resources
INSERT OR IGNORE INTO resources (id, path, type, collection, title, metadata) VALUES
('res-001', 'calculus/deriv_01.tex', 'exercise', 'Calculus', 'Derivative Basics', '{"difficulty": "easy", "tags": ["derivatives", "polynomials"]}'),
('res-002', 'calculus/int_01.tex', 'exercise', 'Calculus', 'Integral Basics', '{"difficulty": "medium", "tags": ["integrals", "definite"]}'),
('res-003', 'algebra/matrix_01.tex', 'exercise', 'Linear Algebra', 'Matrix Multiplication', '{"difficulty": "hard", "tags": ["matrices", "multiplication"]}'),
('res-004', 'geometry/circle_01.tex', 'exercise', 'Geometry', 'Circle Area', '{"difficulty": "easy", "tags": ["circle", "area"]}'),
('res-005', 'logo.png', 'figure', 'General', 'DataTeX Logo', '{"caption": "The official logo", "scale": 0.5}');

-- Add sample documents
INSERT OR IGNORE INTO documents (id, title, category, metadata) VALUES
('doc-001', 'Midterm Exam 2024', 'Exams', '{"author": "John Doe", "date": "2024-05-20"}'),
('doc-002', 'Lecture Notes: Calculus', 'Notes', '{"author": "Jane Smith", "term": "Spring 2024"}');

-- Add sample bibliography
INSERT OR IGNORE INTO bibliography (citation_key, entry_type, data) VALUES
('spivak1994', 'book', '{"author": "Michael Spivak", "title": "Calculus", "year": "1994", "publisher": "Publish or Perish"}'),
('knuth1984', 'article', '{"author": "Donald Knuth", "title": "Literate Programming", "year": "1984", "journal": "The Computer Journal"}');

-- Link items to documents
INSERT OR IGNORE INTO document_items (document_id, resource_id, order_index) VALUES
('doc-001', 'res-001', 1),
('doc-001', 'res-002', 2),
('doc-002', 'res-001', 1);
