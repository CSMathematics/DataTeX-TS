-- Exercise types are managed explicitly by the metadata editor. The legacy
-- cleanup trigger deleted every globally-unused type whenever any
-- section/type link was removed, including types still intended for future
-- resources. That left open editors holding invisible, stale foreign keys.
DROP TRIGGER IF EXISTS cleanup_exercise_types;

-- Restore the built-in values that the legacy trigger may already have
-- removed. INSERT OR IGNORE preserves user edits and custom types.
INSERT OR IGNORE INTO exercise_types (id, name, description) VALUES
    ('multiple-choice', 'Multiple Choice', 'Multiple choice questions'),
    ('true-false', 'True/False', 'True or false questions'),
    ('short-answer', 'Short Answer', 'Short answer questions'),
    ('proof', 'Proof', 'Mathematical proofs'),
    ('calculation', 'Calculation', 'Numerical calculations'),
    ('other', 'Other', 'Other exercise types');
