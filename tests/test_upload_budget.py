"""Storage preflight checks use only a fake read-only S3 client."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
from r2_upload_budget import MAX_BUCKET_BYTES, UploadBudgetError, check_upload_budget


def page(items=(), truncated=False, token=None):
    result = {'Contents': [{'Key': key, 'Size': size} for key, size in items], 'IsTruncated': truncated}
    if token is not None:
        result['NextContinuationToken'] = token
    return result


def plan(*items):
    return [{'key': key, 'bytes': size} for key, size in items]


class Client:
    def __init__(self, pages=None, multipart=None):
        self.pages = list(pages if pages is not None else [page()])
        self.multipart = multipart if multipart is not None else {'Uploads': [], 'IsTruncated': False}
        self.calls = []

    def list_multipart_uploads(self, **parameters):
        self.calls.append(('multipart', parameters))
        if isinstance(self.multipart, Exception):
            raise self.multipart
        return self.multipart

    def list_objects_v2(self, **parameters):
        self.calls.append(('objects', parameters))
        response = self.pages.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class UploadBudgetTests(unittest.TestCase):
    def test_existing_4_8_gb_and_new_2_8_gb_fit(self):
        client = Client([page([('old', 4_800_000_000)])])
        result = check_upload_budget(client, 'test-bucket', plan(('old', 4_800_000_000), ('new', 2_800_000_000)))
        self.assertEqual(result['projected_bytes'], 7_600_000_000)
        self.assertEqual(result['additional_bytes'], 2_800_000_000)
        self.assertEqual([name for name, _ in client.calls], ['multipart', 'objects'])
        self.assertEqual(client.calls[0][1]['MaxUploads'], 1)

    def test_retained_release_counts_toward_total(self):
        client = Client([page([('previous-release', 4_800_000_000), ('current-release', 4_800_000_000)])])
        with self.assertRaisesRegex(UploadBudgetError, 'already exceed'):
            check_upload_budget(client, 'test-bucket', plan(('next-release', 100)))

    def test_new_keys_cannot_push_bucket_over_guard(self):
        client = Client([page([('retained', 4_800_000_000)])])
        with self.assertRaisesRegex(UploadBudgetError, 'plus the new files'):
            check_upload_budget(client, 'test-bucket', plan(('new', 4_300_000_000)))

    def test_identical_key_is_not_counted_twice_and_exact_limit_fits(self):
        client = Client([page([('same-key', MAX_BUCKET_BYTES)])])
        result = check_upload_budget(client, 'test-bucket', plan(('same-key', MAX_BUCKET_BYTES)))
        self.assertEqual(result['additional_bytes'], 0)
        self.assertEqual(result['projected_bytes'], MAX_BUCKET_BYTES)

    def test_different_size_at_existing_key_stops(self):
        with self.assertRaisesRegex(UploadBudgetError, 'different-sized'):
            check_upload_budget(Client([page([('same', 4)])]), 'test-bucket', plan(('same', 5)))

    def test_incomplete_multipart_storage_is_never_ignored_or_deleted(self):
        for result in ({'Uploads': [{'Key': 'old', 'UploadId': 'partial'}], 'IsTruncated': False},
                       {'Uploads': [], 'IsTruncated': True}):
            client = Client(multipart=result)
            with self.assertRaisesRegex(UploadBudgetError, 'Incomplete multipart'):
                check_upload_budget(client, 'test-bucket', plan(('new', 1)))
            self.assertEqual([name for name, _ in client.calls], ['multipart'])

    def test_permissions_fail_closed_without_exposing_sdk_details(self):
        for client in (Client(multipart=RuntimeError('SECRET SDK TOKEN')),
                       Client([RuntimeError('SECRET SDK TOKEN')])):
            with self.assertRaises(UploadBudgetError) as raised:
                check_upload_budget(client, 'test-bucket', plan(('new', 1)))
            self.assertNotIn('SECRET', str(raised.exception))

    def test_valid_pagination_is_followed(self):
        client = Client([page([('first', 1)], True, 'next'), page([('second', 2)])])
        result = check_upload_budget(client, 'test-bucket', plan(('new', 3)))
        self.assertEqual(result['projected_bytes'], 6)
        self.assertEqual(client.calls[-1][1]['ContinuationToken'], 'next')

    def test_malformed_listings_fail_closed(self):
        cases = [None, {}, {'Contents': 'wrong', 'IsTruncated': False},
                 {'Contents': [{'Key': 'bad', 'Size': -1}], 'IsTruncated': False},
                 {'Contents': [{'Key': 'bad', 'Size': True}], 'IsTruncated': False},
                 page([('duplicate', 1), ('duplicate', 1)]),
                 page([], True, 'next'), page([('one', 1)], True)]
        for bad in cases:
            with self.subTest(bad=bad), self.assertRaises(UploadBudgetError):
                check_upload_budget(Client([bad]), 'test-bucket', plan(('new', 1)))
        for bad in ({}, {'Uploads': 'wrong', 'IsTruncated': False}):
            with self.subTest(multipart=bad), self.assertRaises(UploadBudgetError):
                check_upload_budget(Client(multipart=bad), 'test-bucket', plan(('new', 1)))

    def test_duplicate_objects_and_tokens_across_pages_stop(self):
        for pages in ([page([('same', 1)], True, 'a'), page([('same', 1)])],
                      [page([('one', 1)], True, 'a'), page([('two', 2)], True, 'a')]):
            with self.assertRaises(UploadBudgetError):
                check_upload_budget(Client(pages), 'test-bucket', plan(('new', 1)))

    def test_missing_or_contradictory_counts_cannot_hide_existing_storage(self):
        cases = [
            {'KeyCount': 93, 'IsTruncated': False},
            {'IsTruncated': False},
            {'KeyCount': False, 'IsTruncated': False},
            {'KeyCount': 0.0, 'IsTruncated': False},
            {'Contents': [], 'KeyCount': 93, 'IsTruncated': False},
            {'Contents': [], 'KeyCount': -1, 'IsTruncated': False},
            {'Contents': [], 'KeyCount': True, 'IsTruncated': False},
            {'Contents': [], 'KeyCount': 1001, 'IsTruncated': False},
            {'Contents': [{'Key': 'stored', 'Size': 7_590_899_528}], 'KeyCount': 0, 'IsTruncated': False},
        ]
        for bad in cases:
            with self.subTest(bad=bad), self.assertRaises(UploadBudgetError):
                check_upload_budget(Client([bad]), 'test-bucket', plan(('new', 8_900_000_000)))

    def test_explicit_zero_count_accepts_normal_empty_response_without_contents(self):
        client = Client([{'KeyCount': 0, 'IsTruncated': False}])
        result = check_upload_budget(client, 'test-bucket', plan(('new', 8_900_000_000)))
        self.assertEqual(result['existing_bytes'], 0)
        self.assertEqual(result['projected_bytes'], 8_900_000_000)

    def test_listing_object_and_page_bounds_are_enforced(self):
        pages = [page([(f'{batch}-{i}', 0) for i in range(1000)], True, str(batch)) for batch in range(10)]
        client = Client(pages)
        with self.assertRaisesRegex(UploadBudgetError, 'too many objects'):
            check_upload_budget(client, 'test-bucket', plan(('new', 1)))
        self.assertEqual(sum(name == 'objects' for name, _ in client.calls), 10)
        client = Client([page([(str(i), 0)], True, str(i)) for i in range(11)])
        with self.assertRaisesRegex(UploadBudgetError, 'safety bound'):
            check_upload_budget(client, 'test-bucket', plan(('new', 1)))
        self.assertEqual(sum(name == 'objects' for name, _ in client.calls), 11)

    def test_invalid_plan_is_rejected_before_any_cloudflare_call(self):
        for files in ([], plan(('same', 1), ('same', 1)), plan(('new', -1)),
                      plan(('new', MAX_BUCKET_BYTES + 1)), [{'key': 'x', 'bytes': True}]):
            client = Client()
            with self.assertRaises(UploadBudgetError):
                check_upload_budget(client, 'test-bucket', files)
            self.assertEqual(client.calls, [])


if __name__ == '__main__':
    unittest.main()
