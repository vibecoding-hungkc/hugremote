"""Live HTTP Git regression. Requires isolated fixture and SSH backend.
Usage: python3 scripts/test_git_remote_live.py BASE_URL FIXTURE_DIR
Never run against production; all writes restricted to supplied scratch fixture.
"""
import json, sys, subprocess
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
base, folder = sys.argv[1:]
b = Path(folder).resolve()
assert str(b).startswith(str(Path.home()/'.hermes/cache/scratch/'))
assert base.startswith('http://127.0.0.1:') and ':8099' not in base
repo = b/"remote repo 'quote' $dollar"
peer = b/'peer'
server='server-ssh-qa-git'
project='qa-remote-git'
def api(endpoint, data=None, expected=200):
    url=base+'/api/git/'+endpoint
    if data is None:
        if 'serverId=' not in endpoint:
            url+=('&' if '?' in endpoint else '?')+'serverId='+server+'&projectId='+project
    else:
        data=json.dumps({'serverId':server,'projectId':project,**data}).encode()
    try:
        with urlopen(Request(url,data=data,headers={'Content-Type':'application/json'}),timeout=25) as r:
            code=r.status; result=json.load(r)
    except HTTPError as e:
        code=e.code; result=json.load(e)
    assert code==expected,(endpoint,code,result)
    return result
def git(cwd,*args):
    return subprocess.check_output(['git','-C',str(cwd),*args],stderr=subprocess.STDOUT).decode().strip()
s=api('status')
assert s['repoRoot']==str(repo) and s['upstream']=='origin/main' and s['hasUpstream'],s
assert any(f['path']=='note.txt' and not f['staged'] for f in s['files']),s
print('PASS live SSH status: actual remote root, main, upstream and changed file')
d=api('diff&file=note.txt'.replace('&','?',1))
assert any(l['type']=='added' and 'REMOTE_GIT_UI_DIFF' in l['content'] for l in d['lines']),d
print('PASS live SSH diff content')
assert any(v['name']=='qa-feature' for v in api('branches')['branches'])
print('PASS live SSH branches')
api('stage',{'file':'note.txt'})
assert 'note.txt' in git(repo,'diff','--cached','--name-only')
api('unstage',{'file':'note.txt'})
assert not git(repo,'diff','--cached','--name-only')
print('PASS live SSH stage and unstage verified on disk')
odd="odd 'name' $value.txt"
api('stage',{'file':odd})
assert odd in git(repo,'diff','--cached','--name-only')
api('stage',{'file':'note.txt'})
message="QA remote 'quote' $(touch SHOULD_NOT_EXIST) ; literal"
api('commit',{'message':message})
assert git(repo,'log','-1','--format=%B')==message
assert not (repo/'SHOULD_NOT_EXIST').exists()
print('PASS live SSH commit and argument injection safety')
api('push',{})
assert git(b/'origin.git','rev-parse','refs/heads/main')==git(repo,'rev-parse','HEAD')
print('PASS live SSH push to disposable bare remote')
git(peer,'pull','--ff-only')
(peer/'peer.txt').write_text('pulled from peer\n')
git(peer,'add','--','peer.txt');git(peer,'commit','-m','peer update');git(peer,'push')
api('pull',{})
assert (repo/'peer.txt').read_text()=='pulled from peer\n'
print('PASS live SSH pull from peer commit')
api('checkout',{'branch':'qa-feature'})
assert git(repo,'branch','--show-current')=='qa-feature'
api('checkout',{'branch':'main'})
print('PASS live SSH checkout and restore')
api('checkout',{'branch':'--orphan'},expected=400)
api('status?serverId=server-local&projectId=qa-remote-git',expected=404)
api('status?serverId=missing&projectId=qa-remote-git',expected=404)
print('PASS invalid branch, wrong project ownership and unknown server rejected')
assert git(peer,'status','--porcelain')==''
(repo/'note.txt').write_text((repo/'note.txt').read_text()+'REMOTE_GIT_BROWSER_PROOF\n')
print('PASS local peer unchanged; remote dirty fixture ready for browser verification')
