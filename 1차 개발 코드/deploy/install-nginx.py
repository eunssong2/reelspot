#!/usr/bin/env python3
"""Install the reviewed app routes without changing Guacamole or TLS configuration."""
import argparse
import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--dry-run', action='store_true')
parser.add_argument('--prepare', action='store_true',
                    help='Install maintenance responses without requiring or exposing an API server.')
args = parser.parse_args()
target = Path('/etc/nginx/sites-available/guacamole')
snippet = Path(__file__).with_name('nginx-app-locations.conf').read_text()
if args.prepare:
    # Preparing Nginx must not expose the development authentication adapters.
    # Running without --prepare later replaces this whole block with the proxy routes.
    snippet = snippet.replace('proxy_pass http://127.0.0.1:8081;',
        'default_type application/json;\n'
        '    add_header Retry-After 60 always;\n'
        '    return 503 \'{"code":"SERVICE_NOT_READY","message":"App server is not connected yet."}\';')
original = target.read_text()
start, end = '# BEGIN AT-THAT-PLACE ROUTES', '# END AT-THAT-PLACE ROUTES'
block = start + '\n' + snippet + '\n' + end + '\n'
if start in original:
    before, old = original.split(start, 1)
    _, after = old.split(end, 1)
    updated = before + block.rstrip('\n') + after
else:
    if original.count('listen 443 ssl;') != 1:
        sys.exit('TLS server block could not be uniquely located. No files changed.')
    # Do not install duplicate routes over manually configured application locations.
    if any(route in original for route in (
        'location ^~ /v1/', 'location /v1/', 'location ^~ /documents/',
        'location /documents/', 'location = /health', 'location = /invite',
        'location = /.well-known/assetlinks.json',
    )):
        sys.exit('Application routes already exist outside the managed block. No files changed.')
    updated = original.replace('listen 443 ssl;', block + '\n    listen 443 ssl;', 1)
if args.dry_run:
    print(updated)
    sys.exit(0)
if os.geteuid() != 0:
    sys.exit('Nginx configuration is owned by root. Run this script with sudo after review.')
if not args.prepare:
    # Prevent accidental publication of developer-login/content-pass adapters.
    try:
        with urllib.request.urlopen('http://127.0.0.1:8081/health', timeout=5) as response:
            health = json.load(response)
        with urllib.request.urlopen('http://127.0.0.1:8081/v1/consent-documents', timeout=5) as response:
            docs = json.load(response).get('documents', [])
    except (OSError, ValueError):
        sys.exit('API is not ready. No Nginx files changed. Use --prepare to install maintenance routes first.')
    if health.get('mode') != 'production' or health.get('auth') != 'provider' or health.get('moderation') == 'development':
        sys.exit('API must run in production/provider mode with moderation before public routing.')
    if any(d.get('development') for d in docs):
        sys.exit('Production API must not expose development documents. No files changed.')
    # Routing and general-release readiness are different stages. The API already
    # rejects onboarding without published required documents; keep that guard,
    # while allowing health, provider login and diagnostics to reach the server.
    if not any(d.get('required') and d.get('kind') == 'consent' for d in docs) or not any(d.get('kind') == 'notice' for d in docs):
        print('안내: 게시 약관이 없어 신규 가입 완료는 차단됩니다. API 연결은 적용합니다.')
backup = target.with_name(target.name + '.backup-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
shutil.copy2(target, backup)
try:
    target.write_text(updated)
    subprocess.run(['/usr/sbin/nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
except BaseException:
    shutil.copy2(backup, target)
    raise
print('Nginx 준비 완료: 앱 경로는 503 준비 중으로 응답합니다.' if args.prepare
      else 'Nginx 연결 완료: 앱 경로를 API 서버로 연결했습니다.')
print('Guacamole 설정 유지. 백업:', backup)
