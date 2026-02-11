# RunnerBar Photo Download Instructions

This document explains how to download photos from RunnerBar API and commit them to the repository.

## Prerequisites

1. Python 3.x installed
2. Required packages: `pip install -r scripts/requirements.txt`
3. Access to RunnerBar API (requires internet connection)

## Step 1: Get Your Parameters

From the RunnerBar website/app, you need:
- **activity_id**: The race event ID (e.g., 28183)
- **uid**: Your user ID (e.g., 3256630)

Optional parameters:
- **face_id**: Your face recognition ID (e.g., 7851335)
- **game_number**: Your bib number (e.g., B51278)
- **pl_id**: Playlist ID (e.g., 3245790)

## Step 2: Verify API Responses (Manual Check)

Before running the script, you can manually check the API responses:

### Check Race Info:
```bash
curl "https://apiface.store.runnerbar.com/yundong/yd_album/getUserGroupAlbumDetail_modify.json?activity_id=28183"
```

Expected response structure:
```json
{
  "activity": {
    "title": "Race Name Here",
    "id": 28183
  }
}
```

### Check Photos List:
```bash
curl "https://apiface.store.runnerbar.com/yundong/faceSearch/getFaceAndGameNumSearchPhotoV2.json?uid=3256630&activity_id=28183&face_id=7851335&game_number=B51278&photoNum=200&pl_id=3245790&source=h5"
```

Expected response structure:
```json
{
  "topicInfoList": [
    {
      "photoId": "12345",
      "url_hq": "https://example.com/photo1.jpg",
      "url": "https://example.com/photo1_thumb.jpg"
    }
  ]
}
```

## Step 3: Run the Download Script

### Basic Usage (Minimal Parameters):
```bash
cd scripts
python download_runnerbar.py --activity-id 28183 --uid 3256630
```

### With All Parameters:
```bash
cd scripts
python download_runnerbar.py \
  --activity-id 28183 \
  --uid 3256630 \
  --face-id 7851335 \
  --game-number B51278 \
  --pl-id 3245790 \
  --photo-num 200 \
  --source runnerbar
```

The script will:
1. Fetch race information from the API
2. Extract the race name from `activity.title`
3. Fetch the photos list from the API
4. Extract photo URLs from `topicInfoList[].url_hq`
5. Download all photos to `docs/images/{race-name}/runnerbar/`
6. Show progress and statistics

## Step 4: Generate Gallery Manifest

After downloading photos, update the gallery manifest:

```bash
cd scripts
python generate_manifest.py
```

This creates/updates `docs/images/manifest.json` which is used by the web gallery.

## Step 5: Commit Photos to Git

Since photos are now included in the repository (`.gitignore` has been updated):

```bash
git add docs/images/
git commit -m "Add photos from [Race Name]"
git push
```

## Troubleshooting

### API Not Accessible
If you get DNS or connection errors:
- Check your internet connection
- Verify the API endpoints are accessible
- Try accessing the URLs in a browser first

### No Photos Downloaded
- Verify your activity_id and uid are correct
- Check if you need optional parameters (face_id, game_number)
- Try increasing `--photo-num` parameter

### Photos Not Showing in Gallery
- Make sure you ran `generate_manifest.py` after downloading
- Check that `manifest.json` was updated
- Verify photo files are valid JPEG/PNG images

## Example Directory Structure

After successful download:
```
docs/images/
├── manifest.json
└── 2024-Shanghai-Marathon/
    └── runnerbar/
        ├── 12345.jpg
        ├── 12346.jpg
        └── ...
```

## Code Verification

The download script (`scripts/download_runnerbar.py`) is designed to handle:
- Extract `activity.title` from race info API
- Extract `url_hq` from `topicInfoList` array in photos API
- Sanitize race names for directory names
- Handle missing or optional fields gracefully
- Skip already downloaded photos
- Show detailed progress and error messages

The generic download script (`scripts/download_photos.py`) supports Type 4 JSON format:
```python
# Type 4: RunnerBar API format
{
  "topicInfoList": [
    {"url_hq": "...", "photoId": "..."}
  ]
}
```

## Notes

- Photos are downloaded in high quality (`url_hq` field)
- Existing photos are not re-downloaded (check by filename)
- Race names are sanitized to be filesystem-safe
- The script handles various error conditions gracefully
