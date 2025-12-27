-- ============================================================================
-- DataTex v2 Unified Schema
-- Ενοποίηση των: FilesDB, FiguresDB, TablesDB, DocumentsDB, BibliographyDB
-- ============================================================================

-- 1. RESOURCES (Πρώην FilesDB, FiguresDB, TablesDB)
-- Εδώ αποθηκεύονται ΟΛΑ τα αρχεία. Το πεδίο 'type' καθορίζει τι είναι.
-- Το πεδίο 'metadata' (JSON) αντικαθιστά τα εξειδικευμένα πεδία κάθε πίνακα.
CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY NOT NULL,      -- UUID
    path TEXT NOT NULL,                -- Το σχετικό path (π.χ. "algebra/ex1.tex")
    type TEXT NOT NULL,                -- 'exercise', 'figure', 'table', 'package', 'preamble'
    collection TEXT NOT NULL,          -- Η "παλιά βάση" (π.χ. "Analysis", "Geometry")
    title TEXT,                        -- Τίτλος ή λεζάντα (Caption)
    content_hash TEXT,                 -- MD5 hash για να ανιχνεύουμε αλλαγές στο αρχείο
    
    -- Το JSON metadata αποθηκεύει δυναμικά πεδία:
    -- Για Files: tags, difficulty, preamble_ref
    -- Για Figures: caption, scale, label
    metadata JSON DEFAULT '{}',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(path) -- Δεν θέλουμε διπλότυπα paths
);

-- Index για γρήγορη αναζήτηση ανά συλλογή και τύπο
CREATE INDEX IF NOT EXISTS idx_resources_collection ON resources(collection);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);


-- 2. DOCUMENTS (Πρώην DocumentsDB - Πίνακας Headers)
-- Τα έγγραφα που δημιουργεί ο χρήστης (Διαγωνίσματα, Φυλλάδια)
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    category TEXT,               -- π.χ. "Exams", "Notes", "Book"
    
    -- Metadata εγγράφου: Author, Date, Class, Preamble settings
    metadata JSON DEFAULT '{}',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- 3. DOCUMENT ITEMS (Πρώην DocumentsDB - Περιεχόμενα)
-- Συνδέει τα Έγγραφα με τα Resources (Many-to-Many)
CREATE TABLE IF NOT EXISTS document_items (
    document_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    order_index INTEGER NOT NULL, -- Η σειρά που εμφανίζεται η άσκηση στο έγγραφο
    
    PRIMARY KEY (document_id, resource_id),
    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE
);


-- 4. BIBLIOGRAPHY (Πρώην BibliographyDB)
-- Κεντρική διαχείριση βιβλιογραφίας για το Project
CREATE TABLE IF NOT EXISTS bibliography (
    citation_key TEXT PRIMARY KEY NOT NULL, -- Το κλειδί για το \cite{key} (π.χ. "spivak1995")
    entry_type TEXT NOT NULL,               -- "book", "article", "phdthesis" κλπ.
    
    -- Όλα τα πεδία BibTeX (author, year, title, publisher, doi, url)
    -- μπαίνουν εδώ σε JSON μορφή. Γλιτώνουμε 30+ κολώνες.
    data JSON NOT NULL,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- 5. DEPENDENCIES (Νέος Πίνακας Σχέσεων)
-- Διαχειρίζεται τις εξαρτήσεις μεταξύ αρχείων.
-- Παραδείγματα:
-- 1. Η Άσκηση Α (source) έχει λύση την Άσκηση Β (target).
-- 2. Η Άσκηση Α (source) περιέχει την Εικόνα Γ (target).
-- 3. Το Έγγραφο Δ (source) χρησιμοποιεί τη Βιβλιογραφία Ε (target).
CREATE TABLE IF NOT EXISTS dependencies (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation_type TEXT NOT NULL, -- "solution_for", "includes_figure", "cites"
    
    PRIMARY KEY (source_id, target_id, relation_type),
    -- Προσοχή: Εδώ δεν βάζουμε αυστηρό FK για resources γιατί το target μπορεί να είναι bibliography
    -- Θα το διαχειριστούμε λογικά (logically) στον κώδικα Rust.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Trigger για αυτόματο update του updated_at (Προαιρετικό αλλά χρήσιμο)
CREATE TRIGGER IF NOT EXISTS update_timestamp_resources 
AFTER UPDATE ON resources 
BEGIN
    UPDATE resources SET updated_at = CURRENT_TIMESTAMP WHERE id = new.id;
END;
