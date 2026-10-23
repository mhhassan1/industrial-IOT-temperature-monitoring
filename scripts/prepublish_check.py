"""Basic guardrails only; does not replace human or GitHub secret scanning."""
import pathlib
import re

ROOT=pathlib.Path(__file__).resolve().parents[1]
SUFFIXES={'.py','.md','.html','.js','.css','.yaml','.yml','.toml','.json','.txt','.env'}
CHECKS={
    'private key block':re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----'),
    'loopback-external access warning':re.compile(r'http://(?:10\.\d{1,3}|192\.168|172\.1[6-9])\.'),
    'git token':re.compile(r'gh[pousr]_[A-Za-z0-9]{30,}'),
    'AWS access key':re.compile(r'AKIA[0-9A-Z]{16}'),
}
failures=[]
for p in ROOT.rglob('*'):
    if not p.is_file() or any(x.startswith('.') and x!='.github' for x in p.relative_to(ROOT).parts): continue
    if p.suffix not in SUFFIXES or p.name=='prepublish_check.py':continue
    text=p.read_text(encoding='utf-8', errors='replace')
    for label,pattern in CHECKS.items():
        if pattern.search(text):failures.append(f'{p.relative_to(ROOT)}: {label}')
if failures:raise SystemExit('Potential unsafe content:\n'+'\n'.join(failures))
print('Basic pre-publication pattern checks passed. Manual review is still required.')
