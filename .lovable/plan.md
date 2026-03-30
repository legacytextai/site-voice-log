

## Plan: Make Recordings Bucket Public

The `recordings` bucket is currently private, preventing downloads. We'll make it public so you can access files via direct URL.

### Changes

**Database migration** — Update the bucket to public:
```sql
UPDATE storage.buckets SET public = true WHERE id = 'recordings';
```

One migration, no code changes. After this, recording files will be downloadable via direct URL from the Cloud storage view.

