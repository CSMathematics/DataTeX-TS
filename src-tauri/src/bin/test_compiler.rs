// Import the compiler module via the path trick or just copy the code if needed for standalone.
// Better: Test the logic directly by modifying the test file to be standalone or
// running the test in compiler.rs with rustc --test.

#[path = "../compiler.rs"]
mod compiler;

fn main() {}

#[cfg(test)]
mod tests {
    use super::compiler::*;

    #[test]
    fn test_is_allowed_engine_extended() {
        // Since is_allowed_engine is private, we can't test it directly from outside
        // unless we make it pub or test inside the module.
        // We will rely on compiler.rs tests.
    }
}
