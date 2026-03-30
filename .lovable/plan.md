

## Plan: Make Transcripts Bucket Public

The simplest fix is to make the `transcripts` bucket public, just like `report-pdfs`. This will let you click on any file in Cloud → Storage and open/download it via a public URL.

### Changes

**Database migration** — Update the bucket to public:
```sql
UPDATE storage.buckets SET public = true WHERE id = 'transcripts';
```

That's it — one migration, no code changes. After this, files in the bucket will be accessible via direct URL and downloadable from the Cloud storage view.

