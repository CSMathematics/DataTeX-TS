export interface LogEntry {
    type: 'error' | 'warning' | 'info';
    message: string;
    line: number;
    file?: string;
}

export function parseLatexLog(logContent: string): LogEntry[] {
    const entries: LogEntry[] = [];
    const lines = logContent.split('\n');

    // Regex for typical LaTeX errors
    // ! Undefined control sequence.
    // l.6 \mistake
    const errorStartRegex = /^!\s+(.*)$/;
    const lineRegex = /^l\.(\d+)/;

    // Regex for Warnings
    // LaTeX Warning: ... on input line 10.
    const warningRegex = /^LaTeX Warning:\s+(.*)\son input line\s+(\d+)\.$/;
    // Generic Warning (Package warnings often don't have "on input line" at the end of the same line)
    const packageWarningRegex = /^(?:Package|Class)\s+(\w+)\s+Warning:\s+(.*)$/;
    const inputLineRegex = /on input line (\d+)\.$/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 1. Check for Errors (starts with !)
        const errorMatch = line.match(errorStartRegex);
        if (errorMatch) {
            const message = errorMatch[1];

            // Try to find line number in the next few lines
            // Usually it looks like "l.10 \somecommand"
            let foundLine = 0;
            for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                const nextLine = lines[j].trim();
                const lineMatch = nextLine.match(lineRegex);
                if (lineMatch) {
                    foundLine = parseInt(lineMatch[1], 10);
                    break;
                }
            }

            entries.push({
                type: 'error',
                message: message,
                line: foundLine
            });
            continue;
        }

        // 2. Check for Warnings
        const warningMatch = line.match(warningRegex);
        if (warningMatch) {
             entries.push({
                type: 'warning',
                message: warningMatch[1],
                line: parseInt(warningMatch[2], 10)
            });
            continue;
        }

        const pkgWarningMatch = line.match(packageWarningRegex);
        if (pkgWarningMatch) {
             // Look ahead for line number
             let foundLine = 0;
             let message = pkgWarningMatch[2];

             // Sometimes the warning continues on next lines or line number is later
             // For simplicity, we just look for "on input line X" in next few lines
             for (let j = i; j < Math.min(i + 5, lines.length); j++) {
                 const nextLine = lines[j].trim();
                 if (j !== i) message += " " + nextLine;

                 const lnMatch = nextLine.match(inputLineRegex);
                 if (lnMatch) {
                     foundLine = parseInt(lnMatch[1], 10);
                     break;
                 }
             }

             entries.push({
                type: 'warning',
                message: `${pkgWarningMatch[1]}: ${message}`,
                line: foundLine
            });
        }
    }

    return entries;
}
