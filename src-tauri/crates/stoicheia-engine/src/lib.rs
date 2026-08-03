//! Copy-first Stoicheia engine integration.
//!
//! The parser, geometry engine, and exact SVG compiler are intentionally kept
//! as sibling modules so their original internal module paths remain intact.

pub mod compiler;
pub mod geometry;
pub mod parser;
pub mod process_runner;
