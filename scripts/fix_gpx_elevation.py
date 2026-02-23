#!/usr/bin/env python3
"""
Fix barometric altimeter calibration errors at the start of GPX files.

Some GPS watches need time to calibrate the barometric altimeter, producing
wildly incorrect elevation values at the beginning of a track. This script
detects and replaces those outlier values with the first stable reading.

Usage:
  python fix_gpx_elevation.py route.gpx              # fix in-place
  python fix_gpx_elevation.py route.gpx -o fixed.gpx # write to new file
  python fix_gpx_elevation.py route.gpx --dry-run     # preview only
"""

import argparse
import sys
import xml.etree.ElementTree as ET


# GPX namespace
NS = 'http://www.topografix.com/GPX/1/1'
ET.register_namespace('', NS)
ET.register_namespace('gpxtpx', 'http://www.garmin.com/xmlschemas/TrackPointExtension/v1')


def fix_gpx_elevation(input_path, output_path=None, threshold=50, dry_run=False):
    """
    Fix bad elevation at the start of a GPX file.

    Detects outlier elevation values by comparing against the median elevation
    of the entire track, then replaces leading bad values with the first
    stable reading.

    Args:
        input_path: Path to GPX file
        output_path: Output path (defaults to overwriting input)
        threshold: Max deviation from median to consider stable (meters)
        dry_run: If True, only report what would be fixed
    """
    tree = ET.parse(input_path)
    root = tree.getroot()

    ns = {'g': NS}
    trkpts = root.findall('.//' + '{' + NS + '}trkpt')

    if len(trkpts) < 2:
        print("Not enough trackpoints to analyze")
        return False

    # Collect all elevation values
    ele_elements = []
    elevations = []
    for pt in trkpts:
        ele = pt.find('{' + NS + '}ele')
        ele_elements.append(ele)
        if ele is not None and ele.text:
            elevations.append(float(ele.text))
        else:
            elevations.append(None)

    valid = [e for e in elevations if e is not None]
    if not valid:
        print("No elevation data found")
        return False

    median_ele = sorted(valid)[len(valid) // 2]

    # Find first stable point
    first_good = 0
    for i, e in enumerate(elevations):
        if e is not None and abs(e - median_ele) < threshold:
            first_good = i
            break

    if first_good == 0:
        print("No bad elevation at start detected")
        return False

    stable_val = elevations[first_good]
    print(f"Median elevation: {median_ele:.1f}m")
    print(f"First stable point: index {first_good} ({stable_val:.1f}m)")
    print(f"Bad points 0-{first_good - 1}: "
          f"{elevations[0]:.1f}m .. {elevations[first_good - 1]:.1f}m")

    if dry_run:
        print(f"Would fix {first_good} points to {stable_val:.1f}m (dry run)")
        return True

    # Replace bad values
    for i in range(first_good):
        if ele_elements[i] is not None:
            ele_elements[i].text = str(stable_val)

    out = output_path or input_path
    tree.write(out, xml_declaration=True, encoding='UTF-8')
    print(f"✓ Fixed {first_good} elevation points to {stable_val:.1f}m")
    print(f"✓ Saved to {out}")
    return True


def main():
    parser = argparse.ArgumentParser(
        description='Fix barometric altimeter errors at start of GPX files')
    parser.add_argument('gpx_file', help='GPX file to fix')
    parser.add_argument('-o', '--output', help='Output file (default: overwrite input)')
    parser.add_argument('--threshold', type=float, default=50,
                        help='Max deviation from median elevation in meters (default: 50)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview changes without modifying the file')
    args = parser.parse_args()

    if not fix_gpx_elevation(args.gpx_file, args.output, args.threshold, args.dry_run):
        sys.exit(1)


if __name__ == '__main__':
    main()
