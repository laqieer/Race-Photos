#!/usr/bin/env python3
"""Download GPX route from Strava API for a given activity ID."""

import json
import sys
import argparse
import requests
from datetime import datetime, timedelta, timezone
from pathlib import Path


def refresh_token(token_file: Path) -> str:
    """Refresh Strava access token if expired."""
    data = json.load(open(token_file))
    if data.get('expires_at', 0) > datetime.now().timestamp():
        return data['access_token']
    
    print("Refreshing Strava token...")
    resp = requests.post('https://www.strava.com/oauth/token', data={
        'client_id': data.get('client_id', '126744'),
        'client_secret': data.get('client_secret', ''),
        'grant_type': 'refresh_token',
        'refresh_token': data['refresh_token']
    })
    resp.raise_for_status()
    new_data = resp.json()
    # Preserve client credentials
    new_data['client_id'] = data.get('client_id', '126744')
    new_data['client_secret'] = data.get('client_secret', '')
    with open(token_file, 'w') as f:
        json.dump(new_data, f)
    print("✓ Token refreshed")
    return new_data['access_token']


def download_gpx(activity_id: str, token: str, output_path: Path):
    """Download activity streams from Strava and write as GPX."""
    headers = {'Authorization': f'Bearer {token}'}

    # Get activity details
    print(f"Fetching activity {activity_id}...")
    act = requests.get(f'https://www.strava.com/api/v3/activities/{activity_id}',
                       headers=headers)
    act.raise_for_status()
    act_data = act.json()
    start_time = datetime.fromisoformat(act_data['start_date'].replace('Z', '+00:00'))
    name = act_data['name']
    print(f"✓ {name} ({act_data['start_date_local'][:10]}, {act_data['distance']/1000:.1f}km)")

    # Get streams
    resp = requests.get(f'https://www.strava.com/api/v3/activities/{activity_id}/streams',
                        headers=headers,
                        params={'keys': 'latlng,altitude,time,heartrate', 'key_type': 'distance'})
    resp.raise_for_status()
    streams = {s['type']: s['data'] for s in resp.json()}

    if 'latlng' not in streams:
        print("✗ No GPS data in this activity", file=sys.stderr)
        return False

    # Build GPX
    gpx_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx xmlns="http://www.topografix.com/GPX/1/1" '
        'xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1" '
        'version="1.1" creator="Strava">',
        '  <trk>',
        f'    <name>{name}</name>',
        '    <trkseg>'
    ]

    hr_data = streams.get('heartrate')
    alt_data = streams.get('altitude')

    # Fix bad elevation at start (Strava barometer calibration issue)
    if alt_data:
        median_ele = sorted(alt_data)[len(alt_data) // 2]
        threshold = 50  # meters from median
        first_good = 0
        for j, e in enumerate(alt_data):
            if abs(e - median_ele) < threshold:
                first_good = j
                break
        if first_good > 0:
            stable_val = alt_data[first_good]
            for j in range(first_good):
                alt_data[j] = stable_val

    for i in range(len(streams['latlng'])):
        lat, lon = streams['latlng'][i]
        ele = alt_data[i] if alt_data else None
        t = start_time + timedelta(seconds=streams['time'][i])
        time_str = t.strftime('%Y-%m-%dT%H:%M:%SZ')
        gpx_lines.append(f'      <trkpt lat="{lat}" lon="{lon}">')
        if ele is not None:
            gpx_lines.append(f'        <ele>{ele}</ele>')
        gpx_lines.append(f'        <time>{time_str}</time>')
        if hr_data and hr_data[i] is not None:
            gpx_lines.append('        <extensions><gpxtpx:TrackPointExtension>')
            gpx_lines.append(f'          <gpxtpx:hr>{hr_data[i]}</gpxtpx:hr>')
            gpx_lines.append('        </gpxtpx:TrackPointExtension></extensions>')
        gpx_lines.append('      </trkpt>')

    gpx_lines += ['    </trkseg>', '  </trk>', '</gpx>']

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(gpx_lines))
    print(f"✓ Written {len(streams['latlng'])} trackpoints to {output_path}")
    return True


def main():
    parser = argparse.ArgumentParser(description='Download GPX from Strava API')
    parser.add_argument('activity_id', help='Strava activity ID')
    parser.add_argument('-o', '--output', help='Output GPX file path')
    parser.add_argument('--token-file', default='strava_token.json',
                        help='Path to Strava token JSON (default: strava_token.json)')
    args = parser.parse_args()

    token_file = Path(args.token_file)
    if not token_file.exists():
        print(f"✗ Token file not found: {token_file}", file=sys.stderr)
        sys.exit(1)

    token = refresh_token(token_file)

    if args.output:
        output = Path(args.output)
    else:
        # Auto-name from activity
        headers = {'Authorization': f'Bearer {token}'}
        act = requests.get(f'https://www.strava.com/api/v3/activities/{args.activity_id}',
                           headers=headers).json()
        name = act.get('name', args.activity_id)
        # Sanitize filename
        safe_name = "".join(c if c.isalnum() or c in (' ', '-', '_', '（', '）') else '_' for c in name).strip()
        output = Path(f'docs/routes/{safe_name}.gpx')

    if not download_gpx(args.activity_id, token, output):
        sys.exit(1)


if __name__ == '__main__':
    main()
