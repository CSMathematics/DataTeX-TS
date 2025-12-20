import re

with open('src/components/wizards/preamble/SymbolDB.ts', 'r') as f:
    content = f.read()

# Replace '\fa' with '\fa' inside the fontawesome array
# The previous script generated single quotes with single backslash because of how it was constructed.
# Let's fix it by regex replace on the specific lines.
# Pattern: { cmd: '\fa...
# We want: { cmd: '\fa...

# We only want to target the fontawesome section to be safe, or just globally since \fa is unique to this context.
# But let's be careful.

# Regex: { cmd: '\fa  --> this matches a single backslash followed by fa because backslash is escaped in regex
# wait, in python re: '\\' matches a single literal backslash.
# In the file, we have: { cmd: '\fa...'
# This is actually a single backslash in the file content.
# So we want to replace  with .

# Regex for literal \fa:  r'\fa'
# Replacement: r'\\fa'

new_content = re.sub(r"'\\fa", r"'\\\\fa", content)
# Wait, if I read the file, '\fa' comes as backslash f a.
# In JS string literal in file: '\faHome' -> this is actually invalid JS if \f is form feed.
# But if it was written as literally backslash f a, it might be okay?
# Let's check what is in the file.

with open('src/components/wizards/preamble/SymbolDB.ts', 'w') as f:
    f.write(new_content)
