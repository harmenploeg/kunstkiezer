"""Configure only the two public Supabase bindings, preserving other settings."""
import json, os, urllib.request
url = os.environ['PUBLIC_SUPABASE_URL']
key = os.environ['PUBLIC_SUPABASE_PUBLISHABLE_KEY']
if not url.startswith('https://') or not key.startswith('sb_publishable_'):
    raise SystemExit('Expected a public Supabase URL and publishable key')
endpoint = 'https://api.cloudflare.com/client/v4/accounts/' + os.environ['CLOUDFLARE_ACCOUNT_ID'] + '/pages/projects/kunstkiezer'
headers = {'Authorization': 'Bearer ' + os.environ['CLOUDFLARE_API_TOKEN'], 'Content-Type': 'application/json'}
bindings = {name: {'type':'plain_text', 'value':value} for name,value in {'PUBLIC_SUPABASE_URL':url,'PUBLIC_SUPABASE_PUBLISHABLE_KEY':key}.items()}
body = {'deployment_configs': {stage: {'env_vars':bindings} for stage in ['production','preview']}}
request = urllib.request.Request(endpoint, data=json.dumps(body).encode(), headers=headers, method='PATCH')
with urllib.request.urlopen(request, timeout=30) as response:
    result=json.load(response)
if not result.get('success'):
    raise SystemExit('Could not configure Pages public bindings')
print('Public Supabase bindings configured for kunstkiezer')
