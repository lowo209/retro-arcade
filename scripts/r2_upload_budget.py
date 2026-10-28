"""Read-only, bounded bucket storage preflight for the local R2 uploader.

This guards this bucket at one point in time. Keep uploads exclusive: unrelated
account storage or another writer can consume allowance outside this check.
No SDK dependency is imported here; clients only need the two listing methods.
"""

MAX_BUCKET_BYTES = 9_000_000_000
MAX_BUCKET_OBJECTS = 10_000
MAX_LIST_PAGES = 11


class UploadBudgetError(ValueError):
    """Safe, operator-facing message; never contains SDK data or credentials."""


def _key(value):
    return isinstance(value, str) and bool(value) and len(value.encode('utf8')) <= 1024


def _size(value):
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def check_upload_budget(client, bucket, files):
    """Reject uploads unless existing objects plus new keys fit the 9 GB guard.

    At most one multipart listing and eleven object-list pages are read. Missing
    permissions, malformed responses, incomplete listings and unknown multipart
    storage all stop the upload. Existing-key byte/hash identity is still checked
    by authenticated HEAD in the caller before it can skip a stored object.
    """
    if not isinstance(files, list) or not 0 < len(files) <= MAX_BUCKET_OBJECTS:
        raise UploadBudgetError('The upload plan is invalid or too large to check safely. Prepare the release again.')
    planned = {}
    for item in files:
        if not isinstance(item, dict) or not _key(item.get('key')) or not _size(item.get('bytes')) or item['key'] in planned:
            raise UploadBudgetError('The upload plan contains invalid or duplicate objects. Prepare the release again.')
        planned[item['key']] = item['bytes']
    if sum(planned.values()) > MAX_BUCKET_BYTES:
        raise UploadBudgetError('The prepared release exceeds the 9 GB storage guard. Reduce it before uploading.')

    try:
        multipart = client.list_multipart_uploads(Bucket=bucket, MaxUploads=1)
    except Exception:
        raise UploadBudgetError('Could not check incomplete uploads. No files were uploaded; verify bucket-list permissions before retrying.') from None
    if (not isinstance(multipart, dict) or not isinstance(multipart.get('Uploads', []), list)
            or not isinstance(multipart.get('IsTruncated'), bool)):
        raise UploadBudgetError('Cloudflare returned an incomplete upload-storage check. No files were uploaded.')
    if multipart.get('Uploads') or multipart['IsTruncated']:
        raise UploadBudgetError('Incomplete multipart uploads already use storage. Review them in Cloudflare before retrying; nothing was deleted.')

    existing = {}
    total = 0
    continuation = None
    seen_tokens = set()
    for _ in range(MAX_LIST_PAGES):
        parameters = {'Bucket': bucket, 'MaxKeys': 1000}
        if continuation is not None:
            parameters['ContinuationToken'] = continuation
        try:
            page = client.list_objects_v2(**parameters)
        except Exception:
            raise UploadBudgetError('Could not check all stored objects. No files were uploaded; verify bucket-list permissions before retrying.') from None
        if not isinstance(page, dict) or not isinstance(page.get('IsTruncated'), bool):
            raise UploadBudgetError('Cloudflare returned an incomplete object-storage check. No files were uploaded.')
        if 'Contents' not in page:
            # An empty S3 response may omit Contents. It must explicitly say
            # zero objects; a missing payload must never hide existing storage.
            if not _size(page.get('KeyCount')) or page['KeyCount'] != 0:
                raise UploadBudgetError('Cloudflare returned an incomplete object-storage check. No files were uploaded.')
            contents = []
        else:
            contents = page['Contents']
        if (not isinstance(contents, list) or len(contents) > 1000
                or ('KeyCount' in page and (not _size(page['KeyCount'])
                    or page['KeyCount'] > 1000 or page['KeyCount'] != len(contents)))):
            raise UploadBudgetError('Cloudflare returned an inconsistent object-storage count. No files were uploaded.')
        for item in contents:
            if (not isinstance(item, dict) or not _key(item.get('Key')) or not _size(item.get('Size'))
                    or item['Key'] in existing):
                raise UploadBudgetError('Stored-object metadata is invalid or duplicated. No files were uploaded.')
            existing[item['Key']] = item['Size']
            total += item['Size']
            if len(existing) > MAX_BUCKET_OBJECTS:
                raise UploadBudgetError('The bucket has too many objects for this bounded storage check. Review it before uploading.')
            if total > MAX_BUCKET_BYTES:
                raise UploadBudgetError('Stored objects already exceed the 9 GB guard. Review retained releases before uploading; nothing was deleted.')
        if not page['IsTruncated']:
            break
        continuation = page.get('NextContinuationToken')
        if not contents or not isinstance(continuation, str) or not continuation or continuation in seen_tokens or len(continuation) > 4096:
            raise UploadBudgetError('The object listing did not complete safely. No files were uploaded.')
        if len(existing) >= MAX_BUCKET_OBJECTS:
            raise UploadBudgetError('The bucket has too many objects for this bounded storage check. Review it before uploading.')
        seen_tokens.add(continuation)
    else:
        raise UploadBudgetError('The object listing exceeded its safety bound. No files were uploaded.')

    for key, size in planned.items():
        if key in existing and existing[key] != size:
            raise UploadBudgetError('A different-sized object already uses a planned release key. Review the release before uploading.')
    additional = sum(size for key, size in planned.items() if key not in existing)
    projected = total + additional
    if projected > MAX_BUCKET_BYTES:
        raise UploadBudgetError('Existing objects plus the new files would exceed the 9 GB storage guard. Review retained releases before uploading; nothing was deleted.')
    return {'existing_bytes': total, 'additional_bytes': additional, 'projected_bytes': projected,
            'existing_objects': len(existing), 'limit_bytes': MAX_BUCKET_BYTES}
