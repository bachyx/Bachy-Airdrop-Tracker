# Airdrop Tracker

Pantau airdrop yang sudah diklaim, sedang berjalan, dan belum dikerjakan — data tersimpan di browser (localStorage).

## Fitur
- Tambah/edit/hapus airdrop
- Filter berdasarkan status
- Sort & search
- Ringkasan statistik
- Export/import data (JSON/CSV)
- Mode gelap/terang
- Data tersimpan di browser (privacy)

## Deploy ke Vercel
1. Push project ini ke GitHub
2. Import di Vercel Dashboard
3. Deploy (auto-detect, no config needed)

Atau pakai CLI:
```bash
npm i -g vercel
vercel
```

## Tech
- Vanilla JS (no framework, lightweight)
- Vercel-hosted static site
- localStorage for persistence
