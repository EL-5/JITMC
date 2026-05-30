import os
import glob

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content.replace('sky', 'slate').replace('indigo', 'slate')
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for d in ['app', 'components', 'lib']:
    for filepath in glob.glob(f"{d}/**/*.tsx", recursive=True):
        replace_in_file(filepath)
    for filepath in glob.glob(f"{d}/**/*.ts", recursive=True):
        replace_in_file(filepath)
        
print("Done.")
