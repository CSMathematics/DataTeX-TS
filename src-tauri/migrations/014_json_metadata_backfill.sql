-- ============================================================================
-- Safe JSON metadata -> typed-table backfill
--
-- Migration 011 was never added to the Rust migration list and no longer
-- matches the current typed schemas.  This final migration intentionally keeps
-- 011 untouched (so historical version ordering remains stable) and performs
-- the backfill using the current column names.
--
-- Safety properties:
--   * malformed JSON is ignored;
--   * existing typed rows are never updated or replaced;
--   * every scalar/junction foreign key is checked before insertion;
--   * required names have a deterministic non-null fallback;
--   * every statement is idempotent.
-- ============================================================================

-- ==========================================================================
-- Files
-- ==========================================================================

WITH candidates AS (
    SELECT
        r.*,
        CASE WHEN json_valid(r.metadata) THEN r.metadata ELSE '{}' END AS meta
    FROM resources r
    WHERE r.type = 'file' AND json_valid(r.metadata)
)
INSERT OR IGNORE INTO resource_files (
    resource_id,
    file_type_id,
    field_id,
    difficulty,
    date,
    solved_prooved,
    solution_id,
    bibliography,
    file_content,
    preamble_id,
    build_command,
    file_description
)
SELECT
    c.id,
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.fileTypeId'),
            json_extract(c.meta, '$.fileType')
        ) IN (SELECT id FROM file_types)
        THEN COALESCE(
            json_extract(c.meta, '$.fileTypeId'),
            json_extract(c.meta, '$.fileType')
        )
        ELSE NULL
    END,
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.fieldId'),
            json_extract(c.meta, '$.field')
        ) IN (SELECT id FROM fields)
        THEN COALESCE(
            json_extract(c.meta, '$.fieldId'),
            json_extract(c.meta, '$.field')
        )
        ELSE NULL
    END,
    CASE
        WHEN CAST(json_extract(c.meta, '$.difficulty') AS INTEGER) BETWEEN 1 AND 5
        THEN CAST(json_extract(c.meta, '$.difficulty') AS INTEGER)
        ELSE NULL
    END,
    json_extract(c.meta, '$.date'),
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.solvedProoved'),
            json_extract(c.meta, '$.solved_prooved')
        ) IN (1, 'true', 'TRUE')
        THEN 1
        ELSE 0
    END,
    CASE
        WHEN json_extract(c.meta, '$.solutionId') IN (SELECT id FROM resources)
        THEN json_extract(c.meta, '$.solutionId')
        ELSE NULL
    END,
    json_extract(c.meta, '$.bibliography'),
    json_extract(c.meta, '$.fileContent'),
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.preambleId'),
            json_extract(c.meta, '$.preamble')
        ) IN (SELECT id FROM resources)
        THEN COALESCE(
            json_extract(c.meta, '$.preambleId'),
            json_extract(c.meta, '$.preamble')
        )
        ELSE NULL
    END,
    json_extract(c.meta, '$.buildCommand'),
    COALESCE(
        json_extract(c.meta, '$.fileDescription'),
        json_extract(c.meta, '$.description')
    )
FROM candidates c
WHERE NOT EXISTS (
    SELECT 1 FROM resource_files typed WHERE typed.resource_id = c.id
);

WITH candidates AS (
    SELECT
        r.id,
        CASE WHEN json_valid(r.metadata) THEN r.metadata ELSE '{}' END AS meta
    FROM resources r
    WHERE r.type = 'file' AND json_valid(r.metadata)
)
INSERT OR IGNORE INTO resource_file_chapters (resource_id, chapter_id)
SELECT c.id, CAST(item.value AS TEXT)
FROM candidates c
JOIN json_each(c.meta, '$.chapters') AS item ON TRUE
JOIN resource_files typed ON typed.resource_id = c.id
JOIN chapters lookup ON lookup.id = CAST(item.value AS TEXT)
WHERE json_type(c.meta, '$.chapters') = 'array'
  AND item.type IN ('text', 'integer');

WITH candidates AS (
    SELECT
        r.id,
        CASE WHEN json_valid(r.metadata) THEN r.metadata ELSE '{}' END AS meta
    FROM resources r
    WHERE r.type = 'file' AND json_valid(r.metadata)
)
INSERT OR IGNORE INTO resource_file_sections (resource_id, section_id)
SELECT c.id, CAST(item.value AS TEXT)
FROM candidates c
JOIN json_each(c.meta, '$.sections') AS item ON TRUE
JOIN resource_files typed ON typed.resource_id = c.id
JOIN sections lookup ON lookup.id = CAST(item.value AS TEXT)
WHERE json_type(c.meta, '$.sections') = 'array'
  AND item.type IN ('text', 'integer');

WITH candidates AS (
    SELECT
        r.id,
        CASE WHEN json_valid(r.metadata) THEN r.metadata ELSE '{}' END AS meta
    FROM resources r
    WHERE r.type = 'file' AND json_valid(r.metadata)
)
INSERT OR IGNORE INTO resource_file_subsections (resource_id, subsection_id)
SELECT c.id, CAST(item.value AS TEXT)
FROM candidates c
JOIN json_each(c.meta, '$.subsections') AS item ON TRUE
JOIN resource_files typed ON typed.resource_id = c.id
JOIN subsections lookup ON lookup.id = CAST(item.value AS TEXT)
WHERE json_type(c.meta, '$.subsections') = 'array'
  AND item.type IN ('text', 'integer');

WITH candidates AS (
    SELECT
        r.id,
        CASE WHEN json_valid(r.metadata) THEN r.metadata ELSE '{}' END AS meta
    FROM resources r
    WHERE r.type = 'file' AND json_valid(r.metadata)
)
INSERT OR IGNORE INTO resource_file_exercise_types (resource_id, exercise_type_id)
SELECT c.id, CAST(item.value AS TEXT)
FROM candidates c
JOIN json_each(c.meta, '$.exerciseTypes') AS item ON TRUE
JOIN resource_files typed ON typed.resource_id = c.id
JOIN exercise_types lookup ON lookup.id = CAST(item.value AS TEXT)
WHERE json_type(c.meta, '$.exerciseTypes') = 'array'
  AND item.type IN ('text', 'integer');

WITH candidates AS (
    SELECT
        r.id,
        CASE WHEN json_valid(r.metadata) THEN r.metadata ELSE '{}' END AS meta
    FROM resources r
    WHERE r.type = 'file' AND json_valid(r.metadata)
)
INSERT OR IGNORE INTO resource_file_packages (resource_id, package_id)
SELECT c.id, CAST(item.value AS TEXT)
FROM candidates c
JOIN json_each(c.meta, '$.requiredPackages') AS item ON TRUE
JOIN resource_files typed ON typed.resource_id = c.id
JOIN texlive_packages lookup ON lookup.id = CAST(item.value AS TEXT)
WHERE json_type(c.meta, '$.requiredPackages') = 'array'
  AND item.type IN ('text', 'integer');

-- ==========================================================================
-- Documents (legacy folder columns are intentionally not referenced)
-- ==========================================================================

WITH candidates AS (
    SELECT
        r.*,
        CASE WHEN json_valid(r.metadata) THEN r.metadata ELSE '{}' END AS meta
    FROM resources r
    WHERE r.type = 'document' AND json_valid(r.metadata)
)
INSERT OR IGNORE INTO resource_documents (
    resource_id,
    title,
    document_type_id,
    field_id,
    date,
    content,
    preamble_id,
    build_command,
    bibliography,
    description,
    solution_document_id
)
SELECT
    c.id,
    COALESCE(json_extract(c.meta, '$.title'), c.title),
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.documentTypeId'),
            json_extract(c.meta, '$.documentType')
        ) IN (SELECT id FROM document_types)
        THEN COALESCE(
            json_extract(c.meta, '$.documentTypeId'),
            json_extract(c.meta, '$.documentType')
        )
        ELSE NULL
    END,
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.fieldId'),
            json_extract(c.meta, '$.field')
        ) IN (SELECT id FROM fields)
        THEN COALESCE(
            json_extract(c.meta, '$.fieldId'),
            json_extract(c.meta, '$.field')
        )
        ELSE NULL
    END,
    json_extract(c.meta, '$.date'),
    json_extract(c.meta, '$.content'),
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.preambleId'),
            json_extract(c.meta, '$.preamble')
        ) IN (SELECT id FROM resources)
        THEN COALESCE(
            json_extract(c.meta, '$.preambleId'),
            json_extract(c.meta, '$.preamble')
        )
        ELSE NULL
    END,
    json_extract(c.meta, '$.buildCommand'),
    json_extract(c.meta, '$.bibliography'),
    json_extract(c.meta, '$.description'),
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.solutionDocumentId'),
            json_extract(c.meta, '$.solutionDocument')
        ) IN (SELECT id FROM resources)
        THEN COALESCE(
            json_extract(c.meta, '$.solutionDocumentId'),
            json_extract(c.meta, '$.solutionDocument')
        )
        ELSE NULL
    END
FROM candidates c
WHERE NOT EXISTS (
    SELECT 1 FROM resource_documents typed WHERE typed.resource_id = c.id
);

WITH candidates AS (
    SELECT
        r.id,
        CASE WHEN json_valid(r.metadata) THEN r.metadata ELSE '{}' END AS meta
    FROM resources r
    WHERE r.type = 'document' AND json_valid(r.metadata)
)
INSERT OR IGNORE INTO resource_document_chapters (resource_id, chapter_id)
SELECT c.id, CAST(item.value AS TEXT)
FROM candidates c
JOIN json_each(c.meta, '$.chapters') AS item ON TRUE
JOIN resource_documents typed ON typed.resource_id = c.id
JOIN chapters lookup ON lookup.id = CAST(item.value AS TEXT)
WHERE json_type(c.meta, '$.chapters') = 'array'
  AND item.type IN ('text', 'integer');

WITH candidates AS (
    SELECT
        r.id,
        CASE WHEN json_valid(r.metadata) THEN r.metadata ELSE '{}' END AS meta
    FROM resources r
    WHERE r.type = 'document' AND json_valid(r.metadata)
)
INSERT OR IGNORE INTO resource_document_sections (resource_id, section_id)
SELECT c.id, CAST(item.value AS TEXT)
FROM candidates c
JOIN json_each(c.meta, '$.sections') AS item ON TRUE
JOIN resource_documents typed ON typed.resource_id = c.id
JOIN sections lookup ON lookup.id = CAST(item.value AS TEXT)
WHERE json_type(c.meta, '$.sections') = 'array'
  AND item.type IN ('text', 'integer');

WITH candidates AS (
    SELECT
        r.id,
        CASE WHEN json_valid(r.metadata) THEN r.metadata ELSE '{}' END AS meta
    FROM resources r
    WHERE r.type = 'document' AND json_valid(r.metadata)
)
INSERT OR IGNORE INTO resource_document_subsections (resource_id, subsection_id)
SELECT c.id, CAST(item.value AS TEXT)
FROM candidates c
JOIN json_each(c.meta, '$.subsections') AS item ON TRUE
JOIN resource_documents typed ON typed.resource_id = c.id
JOIN subsections lookup ON lookup.id = CAST(item.value AS TEXT)
WHERE json_type(c.meta, '$.subsections') = 'array'
  AND item.type IN ('text', 'integer');

-- ==========================================================================
-- Tables
-- ==========================================================================

WITH candidates AS (
    SELECT
        r.*,
        CASE WHEN json_valid(r.metadata) THEN r.metadata ELSE '{}' END AS meta
    FROM resources r
    WHERE r.type = 'table' AND json_valid(r.metadata)
)
INSERT OR IGNORE INTO resource_tables (
    resource_id,
    table_type_id,
    field_id,
    date,
    content,
    caption,
    description,
    environment,
    placement,
    label,
    width,
    alignment,
    rows,
    columns
)
SELECT
    c.id,
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.tableTypeId'),
            json_extract(c.meta, '$.tableType')
        ) IN (SELECT id FROM table_types)
        THEN COALESCE(
            json_extract(c.meta, '$.tableTypeId'),
            json_extract(c.meta, '$.tableType')
        )
        ELSE NULL
    END,
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.fieldId'),
            json_extract(c.meta, '$.field')
        ) IN (SELECT id FROM fields)
        THEN COALESCE(
            json_extract(c.meta, '$.fieldId'),
            json_extract(c.meta, '$.field')
        )
        ELSE NULL
    END,
    json_extract(c.meta, '$.date'),
    json_extract(c.meta, '$.content'),
    json_extract(c.meta, '$.caption'),
    json_extract(c.meta, '$.description'),
    COALESCE(json_extract(c.meta, '$.environment'), 'tabular'),
    json_extract(c.meta, '$.placement'),
    json_extract(c.meta, '$.label'),
    json_extract(c.meta, '$.width'),
    json_extract(c.meta, '$.alignment'),
    CASE
        WHEN json_type(c.meta, '$.rows') IN ('integer', 'real')
        THEN CAST(json_extract(c.meta, '$.rows') AS INTEGER)
        ELSE NULL
    END,
    CASE
        WHEN json_type(c.meta, '$.columns') IN ('integer', 'real')
        THEN CAST(json_extract(c.meta, '$.columns') AS INTEGER)
        ELSE NULL
    END
FROM candidates c
WHERE NOT EXISTS (
    SELECT 1 FROM resource_tables typed WHERE typed.resource_id = c.id
);

-- ==========================================================================
-- Figures
-- ==========================================================================

WITH candidates AS (
    SELECT
        r.*,
        CASE WHEN json_valid(r.metadata) THEN r.metadata ELSE '{}' END AS meta
    FROM resources r
    WHERE r.type = 'figure' AND json_valid(r.metadata)
)
INSERT OR IGNORE INTO resource_figures (
    resource_id,
    figure_type_id,
    field_id,
    environment,
    date,
    content,
    caption,
    description,
    options,
    tikz_style,
    width,
    height,
    label,
    placement,
    alignment,
    preamble_id,
    build_command
)
SELECT
    c.id,
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.figureTypeId'),
            json_extract(c.meta, '$.figureType')
        ) IN (SELECT id FROM figure_types)
        THEN COALESCE(
            json_extract(c.meta, '$.figureTypeId'),
            json_extract(c.meta, '$.figureType')
        )
        ELSE NULL
    END,
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.fieldId'),
            json_extract(c.meta, '$.field')
        ) IN (SELECT id FROM fields)
        THEN COALESCE(
            json_extract(c.meta, '$.fieldId'),
            json_extract(c.meta, '$.field')
        )
        ELSE NULL
    END,
    json_extract(c.meta, '$.environment'),
    json_extract(c.meta, '$.date'),
    json_extract(c.meta, '$.content'),
    json_extract(c.meta, '$.caption'),
    json_extract(c.meta, '$.description'),
    json_extract(c.meta, '$.options'),
    COALESCE(
        json_extract(c.meta, '$.tikzStyle'),
        json_extract(c.meta, '$.tikz_style')
    ),
    json_extract(c.meta, '$.width'),
    json_extract(c.meta, '$.height'),
    json_extract(c.meta, '$.label'),
    json_extract(c.meta, '$.placement'),
    json_extract(c.meta, '$.alignment'),
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.preambleId'),
            json_extract(c.meta, '$.preamble')
        ) IN (SELECT id FROM resources)
        THEN COALESCE(
            json_extract(c.meta, '$.preambleId'),
            json_extract(c.meta, '$.preamble')
        )
        ELSE NULL
    END,
    json_extract(c.meta, '$.buildCommand')
FROM candidates c
WHERE NOT EXISTS (
    SELECT 1 FROM resource_figures typed WHERE typed.resource_id = c.id
);

-- ==========================================================================
-- Commands (uses command_type_id, not the removed file_type_id)
-- ==========================================================================

WITH candidates AS (
    SELECT
        r.*,
        CASE WHEN json_valid(r.metadata) THEN r.metadata ELSE '{}' END AS meta
    FROM resources r
    WHERE r.type = 'command' AND json_valid(r.metadata)
)
INSERT OR IGNORE INTO resource_commands (
    resource_id,
    name,
    command_type_id,
    content,
    description,
    built_in,
    arguments_num,
    optional_argument,
    example
)
SELECT
    c.id,
    COALESCE(
        NULLIF(CAST(json_extract(c.meta, '$.name') AS TEXT), ''),
        NULLIF(CAST(json_extract(c.meta, '$.commandName') AS TEXT), ''),
        NULLIF(c.title, ''),
        c.id
    ),
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.commandTypeId'),
            json_extract(c.meta, '$.commandType'),
            json_extract(c.meta, '$.fileType')
        ) IN (SELECT id FROM command_types)
        THEN COALESCE(
            json_extract(c.meta, '$.commandTypeId'),
            json_extract(c.meta, '$.commandType'),
            json_extract(c.meta, '$.fileType')
        )
        ELSE NULL
    END,
    json_extract(c.meta, '$.content'),
    json_extract(c.meta, '$.description'),
    CASE WHEN json_extract(c.meta, '$.builtIn') IN (1, 'true', 'TRUE') THEN 1 ELSE 0 END,
    CASE
        WHEN json_type(c.meta, '$.argumentsNum') IN ('integer', 'real')
        THEN CAST(json_extract(c.meta, '$.argumentsNum') AS INTEGER)
        ELSE NULL
    END,
    json_extract(c.meta, '$.optionalArgument'),
    json_extract(c.meta, '$.example')
FROM candidates c
WHERE NOT EXISTS (
    SELECT 1 FROM resource_commands typed WHERE typed.resource_id = c.id
);

-- ==========================================================================
-- Packages
-- ==========================================================================

WITH candidates AS (
    SELECT
        r.*,
        CASE WHEN json_valid(r.metadata) THEN r.metadata ELSE '{}' END AS meta
    FROM resources r
    WHERE r.type = 'package' AND json_valid(r.metadata)
)
INSERT OR IGNORE INTO resource_packages (
    resource_id,
    name,
    topic_id,
    date,
    content,
    description,
    options,
    built_in,
    documentation,
    example
)
SELECT
    c.id,
    COALESCE(
        NULLIF(CAST(json_extract(c.meta, '$.name') AS TEXT), ''),
        NULLIF(CAST(json_extract(c.meta, '$.packageName') AS TEXT), ''),
        NULLIF(c.title, ''),
        c.id
    ),
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.topicId'),
            json_extract(c.meta, '$.topic')
        ) IN (SELECT id FROM package_topics)
        THEN COALESCE(
            json_extract(c.meta, '$.topicId'),
            json_extract(c.meta, '$.topic')
        )
        ELSE NULL
    END,
    json_extract(c.meta, '$.date'),
    json_extract(c.meta, '$.content'),
    json_extract(c.meta, '$.description'),
    json_extract(c.meta, '$.options'),
    CASE WHEN json_extract(c.meta, '$.builtIn') IN (1, 'true', 'TRUE') THEN 1 ELSE 0 END,
    json_extract(c.meta, '$.documentation'),
    json_extract(c.meta, '$.example')
FROM candidates c
WHERE NOT EXISTS (
    SELECT 1 FROM resource_packages typed WHERE typed.resource_id = c.id
);

-- ==========================================================================
-- Preambles (uses preamble_type_id, not the removed file_type_id)
-- ==========================================================================

WITH candidates AS (
    SELECT
        r.*,
        CASE WHEN json_valid(r.metadata) THEN r.metadata ELSE '{}' END AS meta
    FROM resources r
    WHERE r.type = 'preamble' AND json_valid(r.metadata)
)
INSERT OR IGNORE INTO resource_preambles (
    resource_id,
    name,
    preamble_type_id,
    content,
    description,
    built_in,
    engines,
    date,
    class,
    paper_size,
    font_size,
    options,
    languages,
    geometry,
    author,
    title,
    use_bibliography,
    bib_compile_engine,
    make_index,
    make_glossaries,
    has_toc,
    has_lot,
    has_lof
)
SELECT
    c.id,
    COALESCE(
        NULLIF(CAST(json_extract(c.meta, '$.name') AS TEXT), ''),
        NULLIF(c.title, ''),
        c.id
    ),
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.preambleTypeId'),
            json_extract(c.meta, '$.preambleType')
        ) IN (SELECT id FROM preamble_types)
        THEN COALESCE(
            json_extract(c.meta, '$.preambleTypeId'),
            json_extract(c.meta, '$.preambleType')
        )
        ELSE NULL
    END,
    json_extract(c.meta, '$.content'),
    json_extract(c.meta, '$.description'),
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.builtIn'),
            json_extract(c.meta, '$.isTemplate')
        ) IN (1, 'true', 'TRUE')
        THEN 1
        ELSE 0
    END,
    json_extract(c.meta, '$.engines'),
    json_extract(c.meta, '$.date'),
    COALESCE(
        json_extract(c.meta, '$.className'),
        json_extract(c.meta, '$.class')
    ),
    json_extract(c.meta, '$.paperSize'),
    CASE
        WHEN json_type(c.meta, '$.fontSize') IN ('integer', 'real')
        THEN CAST(json_extract(c.meta, '$.fontSize') AS INTEGER)
        ELSE NULL
    END,
    json_extract(c.meta, '$.options'),
    json_extract(c.meta, '$.languages'),
    json_extract(c.meta, '$.geometry'),
    json_extract(c.meta, '$.author'),
    json_extract(c.meta, '$.title'),
    CASE WHEN json_extract(c.meta, '$.useBibliography') IN (1, 'true', 'TRUE') THEN 1 ELSE 0 END,
    json_extract(c.meta, '$.bibCompileEngine'),
    CASE WHEN json_extract(c.meta, '$.makeIndex') IN (1, 'true', 'TRUE') THEN 1 ELSE 0 END,
    CASE WHEN json_extract(c.meta, '$.makeGlossaries') IN (1, 'true', 'TRUE') THEN 1 ELSE 0 END,
    CASE WHEN json_extract(c.meta, '$.hasToc') IN (1, 'true', 'TRUE') THEN 1 ELSE 0 END,
    CASE WHEN json_extract(c.meta, '$.hasLot') IN (1, 'true', 'TRUE') THEN 1 ELSE 0 END,
    CASE WHEN json_extract(c.meta, '$.hasLof') IN (1, 'true', 'TRUE') THEN 1 ELSE 0 END
FROM candidates c
WHERE NOT EXISTS (
    SELECT 1 FROM resource_preambles typed WHERE typed.resource_id = c.id
);

-- ==========================================================================
-- Classes
-- ==========================================================================

WITH candidates AS (
    SELECT
        r.*,
        CASE WHEN json_valid(r.metadata) THEN r.metadata ELSE '{}' END AS meta
    FROM resources r
    WHERE r.type = 'class' AND json_valid(r.metadata)
)
INSERT OR IGNORE INTO resource_classes (
    resource_id,
    name,
    file_type_id,
    date,
    content,
    description,
    engines,
    paper_size,
    font_size,
    geometry,
    options,
    languages
)
SELECT
    c.id,
    COALESCE(
        NULLIF(CAST(json_extract(c.meta, '$.name') AS TEXT), ''),
        NULLIF(CAST(json_extract(c.meta, '$.className') AS TEXT), ''),
        NULLIF(c.title, ''),
        c.id
    ),
    CASE
        WHEN COALESCE(
            json_extract(c.meta, '$.fileTypeId'),
            json_extract(c.meta, '$.fileType')
        ) IN (SELECT id FROM file_types)
        THEN COALESCE(
            json_extract(c.meta, '$.fileTypeId'),
            json_extract(c.meta, '$.fileType')
        )
        ELSE NULL
    END,
    json_extract(c.meta, '$.date'),
    json_extract(c.meta, '$.content'),
    json_extract(c.meta, '$.description'),
    json_extract(c.meta, '$.engines'),
    json_extract(c.meta, '$.paperSize'),
    CASE
        WHEN json_type(c.meta, '$.fontSize') IN ('integer', 'real')
        THEN CAST(json_extract(c.meta, '$.fontSize') AS INTEGER)
        ELSE NULL
    END,
    json_extract(c.meta, '$.geometry'),
    json_extract(c.meta, '$.options'),
    json_extract(c.meta, '$.languages')
FROM candidates c
WHERE NOT EXISTS (
    SELECT 1 FROM resource_classes typed WHERE typed.resource_id = c.id
);
