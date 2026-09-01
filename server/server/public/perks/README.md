# Perk assets

DBD's perk icons are Behaviour Interactive's assets, not something this
project can ship for you - drop your own icon files in this folder and
list them in `perks.json`.

Expected shape of `perks.json` (served at `GET /api/perks`):

```json
[
  { "id": "ds", "name": "Decisive Strike", "image": "ds.png" },
  { "id": "bbq", "name": "BBQ & Chili", "image": "bbq.png" }
]
```

- `id` - stable identifier, used by the frontend picker.
- `name` - display name shown in the UI.
- `image` - filename of the icon in this same folder. It's served at
  `/perks/<image>`, so the full URL sent over the WebSocket ends up being
  `http://yourserver:PORT/perks/ds.png`.
