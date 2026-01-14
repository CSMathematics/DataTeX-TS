import re

with open('src/components/wizards/preamble/SymbolDB.ts', 'r') as f:
    content = f.read()

new_content = re.sub(r"'\\fa", r"'\\\\fa", content)

with open('src/components/wizards/preamble/SymbolDB.ts', 'w') as f:
    f.write(new_content)
