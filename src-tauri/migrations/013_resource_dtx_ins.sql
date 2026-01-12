-- ============================================================================
-- Migration 026: DTX and INS Support
-- Adds tables for Literate Programming (DTX) and DocStrip Installers (INS)
-- ============================================================================

-- DTX Resources
CREATE TABLE IF NOT EXISTS resource_dtx (
    resource_id TEXT PRIMARY KEY NOT NULL,
    base_name TEXT,
    version TEXT,
    date TEXT,
    description TEXT,
    provides_classes TEXT, -- JSON Array of class names
    provides_packages TEXT, -- JSON Array of package names
    documentation_checksum TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE
);

-- INS Resources
CREATE TABLE IF NOT EXISTS resource_ins (
    resource_id TEXT PRIMARY KEY NOT NULL,
    target_dtx_id TEXT, -- Optional link to source DTX
    generated_files TEXT, -- JSON Array or text list of generated file names
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    FOREIGN KEY(target_dtx_id) REFERENCES resources(id) ON DELETE SET NULL
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_resource_dtx_base_name ON resource_dtx(base_name);
CREATE INDEX IF NOT EXISTS idx_resource_ins_target_dtx ON resource_ins(target_dtx_id);

-- Trigger for updated_at
CREATE TRIGGER update_resource_dtx_timestamp
AFTER UPDATE ON resource_dtx
BEGIN
    UPDATE resource_dtx SET updated_at = CURRENT_TIMESTAMP 
    WHERE resource_id = NEW.resource_id;
END;

CREATE TRIGGER update_resource_ins_timestamp
AFTER UPDATE ON resource_ins
BEGIN
    UPDATE resource_ins SET updated_at = CURRENT_TIMESTAMP 
    WHERE resource_id = NEW.resource_id;
END;
